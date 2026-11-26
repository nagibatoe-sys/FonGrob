begin;
alter table public.events drop constraint events_status_check;
alter table public.events add constraint events_status_check check(status in ('proposed','open','settled','void'));
alter table public.bets drop constraint bets_status_check;
alter table public.bets add constraint bets_status_check check(status in ('pending','won','lost','void'));
alter table public.events add column cancellation_reason text;
create function public.cancel_event(event_id uuid, reason text) returns void
language plpgsql security definer set search_path='' as $$
declare ev public.events; bet public.bets;
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 if reason is null or length(trim(reason)) < 10 then raise exception 'Укажите причину отмены'; end if;
 select * into ev from public.events where id=event_id for update;
 if not found then raise exception 'Событие не найдено'; end if;
 if ev.status='void' then return; end if;
 if ev.status='settled' then raise exception 'Событие уже рассчитано'; end if;
 for bet in select b.* from public.bets b join public.outcomes o on o.id=b.outcome_id join public.markets m on m.id=o.market_id where m.event_id=cancel_event.event_id and b.status='pending' order by b.profile_id,b.id for update of b loop
  update public.wallets set balance=balance+bet.stake where profile_id=bet.profile_id;
  insert into public.wallet_transactions(profile_id,operation_key,amount) values(bet.profile_id,'refund:'||bet.id,bet.stake);
  update public.bets set status='void' where id=bet.id;
 end loop;
 update public.events set status='void',cancellation_reason=trim(reason) where id=event_id;
end $$;
revoke all on function public.cancel_event(uuid,text) from public;
grant execute on function public.cancel_event(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
