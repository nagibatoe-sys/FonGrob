begin;
create table public.events (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 5 and 160),
 rules text not null check(length(trim(rules)) between 10 and 2000),
 owner_id uuid not null references public.profiles,
 closes_at timestamptz not null,
 status text not null default 'proposed' check(status in ('proposed','open','settled')),
 winner uuid
);
create table public.markets (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events,
 title text not null default 'Да / Нет'
);
create table public.outcomes (
 id uuid primary key default gen_random_uuid(), market_id uuid not null references public.markets,
 label text not null, odds numeric(8,2) not null check(odds between 1.01 and 100)
);
create table public.bets (
 id uuid primary key, profile_id uuid not null references public.profiles,
 outcome_id uuid not null references public.outcomes, stake numeric(16,2) not null check(stake between 10 and 250),
 odds numeric(8,2) not null, status text not null default 'pending' check(status in ('pending','won','lost')),
 created_at timestamptz not null default now()
);
alter table public.events enable row level security;
alter table public.markets enable row level security;
alter table public.outcomes enable row level security;
alter table public.bets enable row level security;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles where profile_id=auth.uid() and role_code in ('ADMIN','SUPER_ADMIN'))
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant select on public.events,public.markets,public.outcomes,public.bets to authenticated;
create policy events_read on public.events for select to authenticated using(status <> 'proposed' or owner_id=auth.uid() or public.is_admin());
create policy markets_read on public.markets for select to authenticated using(exists(select 1 from public.events where id=event_id));
create policy outcomes_read on public.outcomes for select to authenticated using(exists(select 1 from public.markets where id=market_id));
create policy bets_read on public.bets for select to authenticated using(profile_id=auth.uid());

create function public.propose_event(title text, rules text, closes_at timestamptz) returns uuid
language plpgsql security definer set search_path='' as $$
declare eid uuid; mid uuid;
begin
 if auth.uid() is null or closes_at <= now() then raise exception 'Проверьте дату события'; end if;
 insert into public.events(title,rules,owner_id,closes_at) values(trim(title),trim(rules),auth.uid(),closes_at) returning id into eid;
 insert into public.markets(event_id) values(eid) returning id into mid;
 insert into public.outcomes(market_id,label,odds) values(mid,'Да',1.90),(mid,'Нет',1.90);
 return eid;
end $$;
create function public.publish_event(event_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 update public.events set status='open' where id=event_id and status='proposed' and closes_at>now();
 if not found then raise exception 'Событие недоступно'; end if;
end $$;
create function public.place_bet(request_id uuid, outcome_id uuid, stake numeric) returns uuid
language plpgsql security definer set search_path='' as $$
declare ev public.events; chosen public.outcomes; existing public.bets;
begin
 perform 1 from public.wallets where profile_id=auth.uid() for update;
 select * into existing from public.bets where id=request_id;
 if found then
  if existing.profile_id=auth.uid() and existing.outcome_id=place_bet.outcome_id and existing.stake=place_bet.stake then return existing.id; end if;
  raise exception 'Повторный запрос не совпадает';
 end if;
 select e.* into ev from public.events e join public.markets m on m.event_id=e.id join public.outcomes o on o.market_id=m.id where o.id=place_bet.outcome_id for update of e;
 if not found or ev.status<>'open' or ev.closes_at<=clock_timestamp() or ev.owner_id=auth.uid() then raise exception 'Приём прогноза закрыт или вы управляете событием'; end if;
 select * into chosen from public.outcomes o where o.id=place_bet.outcome_id;
 if stake is null or stake<>round(stake,2) or stake not between 10 and 250 or stake='NaN' then raise exception 'Ставка от 10 до 250 OC'; end if;
 update public.wallets set balance=balance-stake where profile_id=auth.uid() and balance>=stake;
 if not found then raise exception 'Недостаточно OC'; end if;
 insert into public.bets(id,profile_id,outcome_id,stake,odds) values(request_id,auth.uid(),chosen.id,stake,chosen.odds);
 insert into public.wallet_transactions(profile_id,operation_key,amount) values(auth.uid(),'bet:'||request_id,-stake);
 return request_id;
end $$;
create function public.settle_event(event_id uuid, winning_outcome uuid) returns void
language plpgsql security definer set search_path='' as $$
declare ev public.events; bet public.bets; payout numeric;
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 select * into ev from public.events where id=event_id for update;
 if ev.status='settled' and ev.winner=winning_outcome then return; end if;
 if ev.status<>'open' or not exists(select 1 from public.outcomes o join public.markets m on o.market_id=m.id where m.event_id=settle_event.event_id and o.id=winning_outcome) then raise exception 'Неверный результат'; end if;
 for bet in select b.* from public.bets b join public.outcomes o on o.id=b.outcome_id join public.markets m on m.id=o.market_id where m.event_id=settle_event.event_id and b.status='pending' order by b.profile_id,b.id for update of b loop
  payout:=case when bet.outcome_id=winning_outcome then round(bet.stake*bet.odds,2) else 0 end;
  if payout>0 then
   update public.wallets set balance=balance+payout where profile_id=bet.profile_id;
   insert into public.wallet_transactions(profile_id,operation_key,amount) values(bet.profile_id,'payout:'||bet.id,payout);
  end if;
  update public.bets set status=case when payout>0 then 'won' else 'lost' end where id=bet.id;
 end loop;
 update public.events set status='settled',winner=winning_outcome where id=event_id;
end $$;
revoke all on function public.propose_event(text,text,timestamptz),public.publish_event(uuid),public.place_bet(uuid,uuid,numeric),public.settle_event(uuid,uuid) from public;
grant execute on function public.propose_event(text,text,timestamptz),public.publish_event(uuid),public.place_bet(uuid,uuid,numeric),public.settle_event(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
