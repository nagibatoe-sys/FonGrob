begin;
create function public.admin_active_events() returns table(id uuid, title text, closes_at timestamptz, status text, bets_count bigint, total_stake numeric)
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 return query select e.id,e.title,e.closes_at,e.status,count(b.id),coalesce(sum(b.stake),0)
 from public.events e left join public.markets m on m.event_id=e.id
 left join public.outcomes o on o.market_id=m.id left join public.bets b on b.outcome_id=o.id
 where e.status='open' group by e.id order by e.closes_at limit 200;
end $$;
create function public.admin_pending_bets() returns table(id uuid, login text, event_title text, outcome text, stake numeric, odds numeric, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 return query select b.id,split_part(u.email,'@',1),e.title,o.label,b.stake,b.odds,b.created_at
 from public.bets b join auth.users u on u.id=b.profile_id join public.outcomes o on o.id=b.outcome_id
 join public.markets m on m.id=o.market_id join public.events e on e.id=m.event_id
 where b.status='pending' order by b.created_at desc limit 200;
end $$;
create function public.admin_finished_games() returns table(id uuid, title text, status text, outcome text, cancellation_reason text, closes_at timestamptz, bets_count bigint, total_stake numeric)
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 return query select e.id,e.title,e.status,w.label,e.cancellation_reason,e.closes_at,count(b.id),coalesce(sum(b.stake),0)
 from public.events e left join public.outcomes w on w.id=e.winner
 left join public.markets m on m.event_id=e.id left join public.outcomes o on o.market_id=m.id
 left join public.bets b on b.outcome_id=o.id
 where e.status in ('settled','void') group by e.id,w.label order by e.closes_at desc limit 200;
end $$;
create function public.admin_operation_logs() returns table(id uuid, login text, operation_key text, amount numeric, created_at timestamptz, event_title text)
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 return query select t.id,split_part(u.email,'@',1),t.operation_key,t.amount,t.created_at,e.title
 from public.wallet_transactions t join auth.users u on u.id=t.profile_id
 left join public.bets b on b.id=case when t.operation_key ~ '^(bet|payout|refund):[0-9a-f-]{36}$' then split_part(t.operation_key,':',2)::uuid else null end
 left join public.outcomes o on o.id=b.outcome_id left join public.markets m on m.id=o.market_id
 left join public.events e on e.id=m.event_id order by t.created_at desc,t.id desc limit 200;
end $$;
revoke all on function public.admin_active_events(),public.admin_pending_bets(),public.admin_finished_games(),public.admin_operation_logs() from public;
grant execute on function public.admin_active_events(),public.admin_pending_bets(),public.admin_finished_games(),public.admin_operation_logs() to authenticated;
notify pgrst,'reload schema';
commit;
