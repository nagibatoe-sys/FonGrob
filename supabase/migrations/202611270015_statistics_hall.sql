begin;
create table public.admin_actions (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
 entity text not null, entity_id text not null, action text not null, details jsonb,
 created_at timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions(created_at desc);
alter table public.admin_actions enable row level security;
revoke all on public.admin_actions from public,anon,authenticated;
grant select on public.admin_actions to authenticated;
create policy admin_actions_read on public.admin_actions for select to authenticated using(public.is_admin());
create function public.record_admin_action() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb;
begin
 if not public.is_admin() then return coalesce(new,old); end if;
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 insert into public.admin_actions(actor_id,entity,entity_id,action,details)
 values(auth.uid(),tg_table_name,coalesce(row_data->>'id',row_data->>'singleton',row_data->>'code',''),tg_op,row_data);
 return coalesce(new,old);
end $$;
revoke all on function public.record_admin_action() from public,anon,authenticated;
create trigger audit_reward_products after insert or update or delete on public.reward_products for each row execute function public.record_admin_action();
create trigger audit_reward_orders after update on public.reward_orders for each row execute function public.record_admin_action();
create trigger audit_achievements after insert or update or delete on public.achievements for each row execute function public.record_admin_action();
create trigger audit_season_settings after update on public.season_settings for each row execute function public.record_admin_action();

create function public.user_statistics(p_id uuid,p_since timestamptz,p_until timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; profile public.profiles; balance numeric; stats jsonb; season_place bigint; season_id uuid;
begin
 target:=coalesce(p_id,auth.uid());
 if auth.uid() is null or target is null then raise insufficient_privilege; end if;
 select * into profile from public.profiles where id=target;
 if not found or (target<>auth.uid() and not profile.public_stats) then raise insufficient_privilege; end if;
 perform public.rollover_seasons();
 select w.balance into balance from public.wallets w where w.profile_id=target;
 select s.id into season_id from public.seasons s where s.status='active';
 if season_id is not null then select l.rank into season_place from public.season_leaderboard(season_id) l where l.profile_id=target; end if;
 select jsonb_build_object(
  'id',target,'name',profile.display_name,'avatar_url',profile.avatar_url,'public_stats',profile.public_stats,
  'balance',balance,'season_position',season_place,
  'bets',count(*),'wins',count(*) filter(where b.status='won'),'losses',count(*) filter(where b.status='lost'),
  'accuracy',coalesce(round(100.0*count(*) filter(where b.status='won')/nullif(count(*) filter(where b.status in ('won','lost')),0),1),0),
  'max_win',coalesce(max(case when b.status='won' then b.stake*b.odds end),0),
  'bet_history',coalesce(jsonb_agg(jsonb_build_object('id',b.id,'title',e.title,'stake',b.stake,'odds',b.odds,'status',b.status,'created_at',b.created_at) order by b.created_at desc) filter(where b.id is not null),'[]'::jsonb)
 ) into stats
 from public.bets b left join public.outcomes o on o.id=b.outcome_id left join public.markets m on m.id=o.market_id left join public.events e on e.id=m.event_id
 where b.profile_id=target and (p_since is null or b.created_at>=p_since) and (p_until is null or b.created_at<p_until);
 stats:=stats||jsonb_build_object(
  'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'amount',t.amount,'operation',t.operation_key,'created_at',t.created_at) order by t.created_at) from public.wallet_transactions t where t.profile_id=target and (p_since is null or t.created_at>=p_since) and (p_until is null or t.created_at<p_until)),'[]'::jsonb),
  'purchases',coalesce((select jsonb_agg(jsonb_build_object('id',ord.id,'name',prod.name,'price',ord.price,'status',ord.status,'created_at',ord.created_at) order by ord.created_at desc) from public.reward_orders ord join public.reward_products prod on prod.id=ord.product_id where ord.profile_id=target and (p_since is null or ord.created_at>=p_since) and (p_until is null or ord.created_at<p_until)),'[]'::jsonb),
  'achievements',coalesce((select jsonb_agg(jsonb_build_object('title',a.title,'icon',a.icon,'rarity',a.rarity,'awarded_at',ua.awarded_at) order by ua.awarded_at desc) from public.user_achievements ua join public.achievements a on a.id=ua.achievement_id where ua.profile_id=target),'[]'::jsonb)
 );
 return stats;
end $$;

create function public.hall_of_fame() returns table(category text,place bigint,profile_id uuid,display_name text,score numeric)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 perform public.rollover_seasons();
 return query with totals as (
  select b.profile_id,count(*) filter(where b.status='won') as wins,
   count(*) filter(where b.status in ('won','lost')) as played,
   coalesce(sum(case when b.status='won' then b.stake*b.odds-b.stake when b.status='lost' then -b.stake else 0 end),0)::numeric as profit,
   coalesce(max(case when b.status='won' then b.stake*b.odds end),0)::numeric as max_win
  from public.bets b group by b.profile_id
 ), entries as (
  select 'Лучшие игроки'::text as category,t.profile_id,t.profit as score from totals t where t.played>0
  union all select 'Самые точные',t.profile_id,round(100.0*t.wins/nullif(t.played,0),1) from totals t where t.played>=10
  union all select 'Максимальный выигрыш',t.profile_id,t.max_win from totals t where t.max_win>0
  union all select 'Правильные прогнозы',t.profile_id,t.wins::numeric from totals t where t.wins>0
  union all select 'Победители сезонов',w.profile_id,count(*)::numeric from public.season_winners w where w.rank=1 group by w.profile_id
  union all select 'Редкие достижения',ua.profile_id,count(*)::numeric from public.user_achievements ua join public.achievements a on a.id=ua.achievement_id where a.rarity in ('rare','epic','legendary') group by ua.profile_id
 ), ranked as (select e.*,row_number() over(partition by e.category order by e.score desc,e.profile_id) as place from entries e)
 select r.category,r.place,case when p.public_stats then r.profile_id else null end,
  case when p.public_stats then p.display_name else 'Участник' end,r.score
 from ranked r join public.profiles p on p.id=r.profile_id where r.place<=3 order by r.category,r.place;
end $$;
revoke all on function public.user_statistics(uuid,timestamptz,timestamptz),public.hall_of_fame() from public;
grant execute on function public.user_statistics(uuid,timestamptz,timestamptz),public.hall_of_fame() to authenticated;
notify pgrst,'reload schema';
commit;
