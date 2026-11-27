begin;
create function public.upsert_reward_category(p_code text,p_name text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 if p_code !~ '^[a-z][a-z0-9_-]{1,31}$' or length(trim(coalesce(p_name,''))) not between 2 and 80 then raise exception 'Проверьте категорию'; end if;
 insert into public.reward_categories(code,name) values(p_code,trim(p_name)) on conflict(code) do update set name=excluded.name;
end $$;
create function public.admin_reward_orders() returns table(id uuid,login text,product_name text,price numeric,status text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 return query select o.id,split_part(u.email,'@',1),p.name,o.price,o.status,o.created_at
 from public.reward_orders o join auth.users u on u.id=o.profile_id join public.reward_products p on p.id=o.product_id order by o.created_at desc limit 200;
end $$;
create function public.admin_user_stats() returns table(id uuid,login text,display_name text,balance numeric,bets bigint,wins bigint,accuracy numeric,orders bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 return query select p.id,split_part(u.email,'@',1),p.display_name,w.balance,
  (select count(*) from public.bets b where b.profile_id=p.id),
  (select count(*) from public.bets b where b.profile_id=p.id and b.status='won'),
  (select coalesce(round(100.0*count(*) filter(where b.status='won')/nullif(count(*) filter(where b.status in ('won','lost')),0),1),0) from public.bets b where b.profile_id=p.id),
  (select count(*) from public.reward_orders o where o.profile_id=p.id)
 from public.profiles p join auth.users u on u.id=p.id join public.wallets w on w.profile_id=p.id order by p.display_name limit 500;
end $$;
create function public.refresh_all_achievements() returns void
language plpgsql security definer set search_path='' as $$
declare member record;
begin
 for member in select id from public.profiles loop perform public.refresh_achievements(member.id); end loop;
end $$;
revoke all on function public.upsert_reward_category(text,text),public.admin_reward_orders(),public.admin_user_stats(),public.refresh_all_achievements() from public;
grant execute on function public.upsert_reward_category(text,text),public.admin_reward_orders(),public.admin_user_stats() to authenticated;
create function public.season_winner_achievement() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.refresh_achievements(new.profile_id); return new; end $$;
revoke all on function public.season_winner_achievement() from public,anon,authenticated;
create trigger season_winner_achievement after insert on public.season_winners for each row execute function public.season_winner_achievement();
notify pgrst,'reload schema';
commit;
