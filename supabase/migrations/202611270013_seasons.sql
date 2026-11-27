begin;
alter table public.profiles add column avatar_url text check(avatar_url is null or avatar_url ~ '^https://[^ ]+$');
alter table public.profiles add column public_stats boolean not null default false;
grant update (avatar_url,public_stats) on public.profiles to authenticated;
create table public.season_settings (
 singleton boolean primary key default true check(singleton), duration_months integer not null default 1 check(duration_months between 1 and 12),
 winner_rule text not null default 'profit' check(winner_rule in ('profit','wins','accuracy')),
 winner_reward numeric(16,2) not null default 100 check(winner_reward>=0 and winner_reward<100000)
);
insert into public.season_settings(singleton) values(true);
create table public.seasons (
 id uuid primary key default gen_random_uuid(), starts_at timestamptz not null unique, ends_at timestamptz not null,
 status text not null check(status in ('active','completed')),
 winner_rule text not null check(winner_rule in ('profit','wins','accuracy')),
 created_at timestamptz not null default now(), check(ends_at>starts_at)
);
create unique index one_active_season on public.seasons(status) where status='active';
create table public.season_winners (
 season_id uuid not null references public.seasons(id), profile_id uuid not null references public.profiles(id),
 rank integer not null check(rank between 1 and 3), score numeric not null, reward_oc numeric(16,2) not null default 0,
 primary key(season_id,rank), unique(season_id,profile_id)
);
alter table public.season_settings enable row level security;
alter table public.seasons enable row level security;
alter table public.season_winners enable row level security;
revoke all on public.season_settings,public.seasons,public.season_winners from public,anon,authenticated;
grant select on public.season_settings,public.seasons,public.season_winners to authenticated;
create policy season_settings_read on public.season_settings for select to authenticated using(true);
create policy seasons_read on public.seasons for select to authenticated using(true);
create policy season_winners_read on public.season_winners for select to authenticated using(true);

create function public.rollover_seasons() returns void
language plpgsql security definer set search_path='' as $$
declare current_season public.seasons; settings public.season_settings; winner record; next_start timestamptz;
begin
 perform pg_catalog.pg_advisory_xact_lock(6819001);
 select * into settings from public.season_settings where singleton;
 select * into current_season from public.seasons where status='active' for update;
 if not found then
  next_start:=pg_catalog.date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  insert into public.seasons(starts_at,ends_at,status,winner_rule) values(next_start,next_start+pg_catalog.make_interval(months=>settings.duration_months),'active',settings.winner_rule);
  return;
 end if;
 while current_season.ends_at<=clock_timestamp() loop
  for winner in
   with results as (
    select b.profile_id,count(*) filter(where b.status in ('won','lost'))::numeric as played,
      count(*) filter(where b.status='won')::numeric as wins,
      coalesce(sum(case when b.status='won' then b.stake*b.odds-b.stake when b.status='lost' then -b.stake else 0 end),0)::numeric as profit
    from public.bets b where b.created_at>=current_season.starts_at and b.created_at<current_season.ends_at group by b.profile_id
   ), ranked as (
    select r.profile_id,row_number() over(order by
      case current_season.winner_rule when 'wins' then r.wins when 'accuracy' then r.wins/nullif(r.played,0)*100 else r.profit end desc nulls last,
      r.wins desc,r.profile_id) as place,
      (case current_season.winner_rule when 'wins' then r.wins when 'accuracy' then r.wins/nullif(r.played,0)*100 else r.profit end) as score
    from results r where r.played>0
   ) select * from ranked where place<=3
  loop
   insert into public.season_winners(season_id,profile_id,rank,score,reward_oc)
    values(current_season.id,winner.profile_id,winner.place,winner.score,case when winner.place=1 then settings.winner_reward else 0 end)
    on conflict do nothing;
   if winner.place=1 and settings.winner_reward>0 then
    perform 1 from public.wallets where profile_id=winner.profile_id for update;
    insert into public.wallet_transactions(profile_id,operation_key,amount) values(winner.profile_id,'season:'||current_season.id,settings.winner_reward) on conflict do nothing;
    if found then update public.wallets set balance=balance+settings.winner_reward where profile_id=winner.profile_id; end if;
   end if;
  end loop;
  update public.seasons set status='completed' where id=current_season.id;
  next_start:=current_season.ends_at;
  insert into public.seasons(starts_at,ends_at,status,winner_rule)
   values(next_start,next_start+pg_catalog.make_interval(months=>settings.duration_months),'active',settings.winner_rule)
   returning * into current_season;
 end loop;
end $$;
revoke all on function public.rollover_seasons() from public,anon,authenticated;

create function public.season_directory() returns table(id uuid,starts_at timestamptz,ends_at timestamptz,status text,winner_rule text,winner_name text,seconds_left numeric)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 perform public.rollover_seasons();
 return query select s.id,s.starts_at,s.ends_at,s.status,s.winner_rule,
  case when p.public_stats then p.display_name else case when w.profile_id is null then null else 'Участник' end end,
  case when s.status='active' then greatest(0,extract(epoch from s.ends_at-clock_timestamp()))::numeric else 0::numeric end
 from public.seasons s left join public.season_winners w on w.season_id=s.id and w.rank=1
 left join public.profiles p on p.id=w.profile_id order by s.starts_at desc;
end $$;
create function public.season_leaderboard(p_season_id uuid) returns table(profile_id uuid,display_name text,bets bigint,wins bigint,profit numeric,accuracy numeric,rank bigint)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 perform public.rollover_seasons();
 if not exists(select 1 from public.seasons where id=p_season_id) then raise exception 'Сезон не найден'; end if;
 return query with totals as (
  select b.profile_id,count(*) filter(where b.status in ('won','lost')) as bets,
   count(*) filter(where b.status='won') as wins,
   coalesce(sum(case when b.status='won' then b.stake*b.odds-b.stake when b.status='lost' then -b.stake else 0 end),0)::numeric as profit
  from public.bets b join public.seasons s on b.created_at>=s.starts_at and b.created_at<s.ends_at where s.id=p_season_id group by b.profile_id
 ) select t.profile_id,case when p.public_stats or t.profile_id=auth.uid() then p.display_name else 'Участник' end,
  t.bets,t.wins,t.profit,round(100*t.wins/nullif(t.bets,0),1),
  row_number() over(order by case s.winner_rule when 'wins' then t.wins::numeric when 'accuracy' then 100*t.wins/nullif(t.bets,0) else t.profit end desc nulls last,t.wins desc,t.profile_id)
 from totals t join public.profiles p on p.id=t.profile_id cross join public.seasons s where s.id=p_season_id and t.bets>0 limit 100;
end $$;
create function public.set_season_settings(p_duration_months integer,p_winner_rule text,p_winner_reward numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 update public.season_settings set duration_months=p_duration_months,winner_rule=p_winner_rule,winner_reward=p_winner_reward where singleton;
end $$;
revoke all on function public.season_directory(),public.season_leaderboard(uuid),public.set_season_settings(integer,text,numeric) from public;
grant execute on function public.season_directory(),public.season_leaderboard(uuid),public.set_season_settings(integer,text,numeric) to authenticated;
notify pgrst,'reload schema';
commit;
