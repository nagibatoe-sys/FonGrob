begin;
create table public.achievements (
 id uuid primary key default gen_random_uuid(), code text not null unique check(code ~ '^[a-z][a-z0-9_]{2,39}$'),
 title text not null check(length(trim(title)) between 2 and 80), description text not null check(length(trim(description)) between 2 and 400),
 rarity text not null check(rarity in ('common','rare','epic','legendary')),
 icon text not null check(length(icon) between 1 and 8),
 rule_code text not null check(rule_code in ('first_bet','wins','accuracy','veteran_days','season_champion','collector','hall_of_fame')),
 threshold integer not null default 1 check(threshold between 1 and 10000),
 reward_oc numeric(16,2) not null default 0 check(reward_oc>=0 and reward_oc<=10000), enabled boolean not null default true
);
insert into public.achievements(code,title,description,rarity,icon,rule_code,threshold,reward_oc) values
 ('first_step','Первый шаг','Первый прогноз','common','★','first_bet',1,0),
 ('seer','Провидец','10 правильных прогнозов','rare','✦','wins',10,0),
 ('analyst','Аналитик','Точность не ниже 70% при 10 рассчитанных ставках','epic','◈','accuracy',70,0),
 ('veteran','Ветеран','30 дней с момента регистрации','rare','◆','veteran_days',30,0),
 ('champion','Чемпион','Победа в сезоне','epic','♛','season_champion',1,0),
 ('collector','Коллекционер','Получить 10 достижений','epic','✹','collector',10,0),
 ('legend','Легенда','Попасть в Зал славы как победитель сезона','legendary','♚','hall_of_fame',1,0);
create table public.user_achievements (
 profile_id uuid not null references public.profiles(id), achievement_id uuid not null references public.achievements(id),
 awarded_at timestamptz not null default now(), primary key(profile_id,achievement_id)
);
create table public.user_notifications (
 id uuid primary key default gen_random_uuid(),profile_id uuid not null references public.profiles(id),
 title text not null,body text not null,created_at timestamptz not null default now(),read_at timestamptz
);
create index user_notifications_profile_idx on public.user_notifications(profile_id,created_at desc);
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_notifications enable row level security;
revoke all on public.achievements,public.user_achievements,public.user_notifications from public,anon,authenticated;
grant select on public.achievements,public.user_achievements,public.user_notifications to authenticated;
create policy achievements_read on public.achievements for select to authenticated using(enabled or public.is_admin());
create policy user_achievements_read on public.user_achievements for select to authenticated using(profile_id=auth.uid() or exists(select 1 from public.profiles p where p.id=profile_id and p.public_stats));
create policy user_notifications_read on public.user_notifications for select to authenticated using(profile_id=auth.uid());

create function public.refresh_achievements(p_profile_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare definition public.achievements; progress numeric; earned uuid; played bigint; won bigint;
begin
 if p_profile_id is null then return; end if;
 select count(*) filter(where status in ('won','lost')),count(*) filter(where status='won') into played,won from public.bets where profile_id=p_profile_id;
 for definition in select * from public.achievements where enabled and rule_code<>'collector' order by code loop
  progress:=case definition.rule_code
   when 'first_bet' then (select count(*) from public.bets where profile_id=p_profile_id)
   when 'wins' then won
   when 'accuracy' then case when played>=10 then 100*won/nullif(played,0) else 0 end
   when 'veteran_days' then (select greatest(0,floor(extract(epoch from clock_timestamp()-u.created_at)/86400)) from auth.users u where u.id=p_profile_id)
   when 'season_champion' then (select count(*) from public.season_winners where profile_id=p_profile_id and rank=1)
   when 'hall_of_fame' then (select count(*) from public.season_winners where profile_id=p_profile_id and rank=1)
   else 0 end;
  if coalesce(progress,0)>=definition.threshold then
   earned:=null;
   insert into public.user_achievements(profile_id,achievement_id) values(p_profile_id,definition.id) on conflict do nothing returning achievement_id into earned;
   if earned is not null then
    insert into public.user_notifications(profile_id,title,body) values(p_profile_id,'Новое достижение',definition.title);
    if definition.reward_oc>0 then
     perform 1 from public.wallets where profile_id=p_profile_id for update;
     insert into public.wallet_transactions(profile_id,operation_key,amount) values(p_profile_id,'achievement:'||definition.id,definition.reward_oc) on conflict do nothing;
     if found then update public.wallets set balance=balance+definition.reward_oc where profile_id=p_profile_id; end if;
    end if;
   end if;
  end if;
 end loop;
 for definition in select * from public.achievements where enabled and rule_code='collector' loop
  if (select count(*) from public.user_achievements where profile_id=p_profile_id)>=definition.threshold then
   earned:=null;
   insert into public.user_achievements(profile_id,achievement_id) values(p_profile_id,definition.id) on conflict do nothing returning achievement_id into earned;
   if earned is not null then
    insert into public.user_notifications(profile_id,title,body) values(p_profile_id,'Новое достижение',definition.title);
    if definition.reward_oc>0 then
     perform 1 from public.wallets where profile_id=p_profile_id for update;
     insert into public.wallet_transactions(profile_id,operation_key,amount) values(p_profile_id,'achievement:'||definition.id,definition.reward_oc) on conflict do nothing;
     if found then update public.wallets set balance=balance+definition.reward_oc where profile_id=p_profile_id; end if;
    end if;
   end if;
  end if;
 end loop;
end $$;
revoke all on function public.refresh_achievements(uuid) from public,anon,authenticated;
create function public.bet_achievement_update() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform public.refresh_achievements(new.profile_id);
 return new;
end $$;
create trigger bet_achievement_insert after insert on public.bets for each row execute function public.bet_achievement_update();
create trigger bet_achievement_settle after update of status on public.bets for each row when(old.status is distinct from new.status) execute function public.bet_achievement_update();

create function public.achievement_progress() returns table(id uuid,code text,title text,description text,rarity text,icon text,threshold integer,current_value numeric,reward_oc numeric,awarded_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare played bigint; won bigint;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 perform public.refresh_achievements(auth.uid());
 select count(*) filter(where status in ('won','lost')),count(*) filter(where status='won') into played,won from public.bets where profile_id=auth.uid();
 return query select a.id,a.code,a.title,a.description,a.rarity,a.icon,a.threshold,
  (case a.rule_code
   when 'first_bet' then (select count(*)::numeric from public.bets b where b.profile_id=auth.uid())
   when 'wins' then won::numeric
   when 'accuracy' then case when played>=10 then round(100*won/nullif(played,0),1) else 0 end
   when 'veteran_days' then (select greatest(0,floor(extract(epoch from clock_timestamp()-u.created_at)/86400)) from auth.users u where u.id=auth.uid())
   when 'season_champion' then (select count(*)::numeric from public.season_winners w where w.profile_id=auth.uid() and w.rank=1)
   when 'hall_of_fame' then (select count(*)::numeric from public.season_winners w where w.profile_id=auth.uid() and w.rank=1)
   when 'collector' then (select count(*)::numeric from public.user_achievements ua where ua.profile_id=auth.uid() and ua.achievement_id<>a.id)
   else 0 end)::numeric, a.reward_oc,ua.awarded_at
 from public.achievements a left join public.user_achievements ua on ua.achievement_id=a.id and ua.profile_id=auth.uid()
 where a.enabled order by ua.awarded_at nulls last,a.rarity,a.title;
end $$;
create function public.upsert_achievement(p_id uuid,p_code text,p_title text,p_description text,p_rarity text,p_icon text,p_rule_code text,p_threshold integer,p_reward_oc numeric,p_enabled boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
 if not public.is_admin() then raise insufficient_privilege; end if;
 if p_code !~ '^[a-z][a-z0-9_]{2,39}$' or length(trim(coalesce(p_title,''))) not between 2 and 80 or length(trim(coalesce(p_description,''))) not between 2 and 400 or p_rarity not in ('common','rare','epic','legendary') or p_rule_code not in ('first_bet','wins','accuracy','veteran_days','season_champion','collector','hall_of_fame') or p_threshold not between 1 and 10000 or p_reward_oc not between 0 and 10000 or length(coalesce(p_icon,'')) not between 1 and 8 then raise exception 'Проверьте достижение'; end if;
 if p_id is null then
  insert into public.achievements(code,title,description,rarity,icon,rule_code,threshold,reward_oc,enabled) values(p_code,trim(p_title),trim(p_description),p_rarity,p_icon,p_rule_code,p_threshold,p_reward_oc,coalesce(p_enabled,true)) returning id into result_id;
 else
  update public.achievements set code=p_code,title=trim(p_title),description=trim(p_description),rarity=p_rarity,icon=p_icon,rule_code=p_rule_code,threshold=p_threshold,reward_oc=p_reward_oc,enabled=coalesce(p_enabled,true) where id=p_id returning id into result_id;
  if result_id is null then raise exception 'Достижение не найдено'; end if;
 end if;
 return result_id;
end $$;
create function public.my_notifications() returns table(id uuid,title text,body text,created_at timestamptz,read_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 return query select n.id,n.title,n.body,n.created_at,n.read_at from public.user_notifications n where n.profile_id=auth.uid() order by n.created_at desc limit 50;
end $$;
create function public.mark_notification_read(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 update public.user_notifications set read_at=now() where id=p_id and profile_id=auth.uid();
end $$;
revoke all on function public.achievement_progress(),public.upsert_achievement(uuid,text,text,text,text,text,text,integer,numeric,boolean),public.my_notifications(),public.mark_notification_read(uuid) from public;
grant execute on function public.achievement_progress(),public.upsert_achievement(uuid,text,text,text,text,text,text,integer,numeric,boolean),public.my_notifications(),public.mark_notification_read(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
