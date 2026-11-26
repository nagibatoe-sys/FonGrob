begin;
create table public.pari (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles(id),
 type text not null check(type in ('binary','multi','free')),
 title text not null check(length(trim(title)) between 1 and 160),
 condition text not null check(length(trim(condition)) between 1 and 2000),
 event_date date, deadline_at timestamptz not null, timezone text not null,
 hidden_answers boolean not null default true,
 status text not null default 'open' check(status in ('draft','open','awaiting_result','completed')),
 result_option_id uuid, result_text text, created_at timestamptz not null default now(),
 check((type='binary' and event_date is not null) or (type<>'binary' and event_date is null))
);
create table public.pari_options (
 id uuid primary key default gen_random_uuid(), pari_id uuid not null references public.pari(id) on delete cascade,
 label text not null check(length(trim(label)) between 1 and 160), position integer not null,
 unique(pari_id,position)
);
alter table public.pari add constraint pari_result_option_fk foreign key(result_option_id) references public.pari_options(id);
create table public.pari_answers (
 id uuid primary key default gen_random_uuid(), pari_id uuid not null references public.pari(id) on delete cascade,
 user_id uuid not null references public.profiles(id), option_id uuid references public.pari_options(id),
 free_text text, created_at timestamptz not null default now(), unique(pari_id,user_id)
);
create index pari_answers_pari_idx on public.pari_answers(pari_id);
revoke all on public.pari,public.pari_options,public.pari_answers from public,anon,authenticated;
alter table public.pari enable row level security;
alter table public.pari_options enable row level security;
alter table public.pari_answers enable row level security;

create function public.create_pari(p_type text,p_title text,p_condition text,p_event_date date,p_deadline_at timestamptz,p_timezone text,p_hidden_answers boolean,p_options jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare new_id uuid; labels text[]; item text; n integer;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_type not in ('binary','multi','free') or p_type is null then raise exception 'Неверный формат пари'; end if;
 if length(trim(coalesce(p_title,''))) not between 1 and 160 or length(trim(coalesce(p_condition,''))) not between 1 and 2000 then raise exception 'Заполните название и условия'; end if;
 if p_deadline_at is null or p_deadline_at <= clock_timestamp() then raise exception 'Дедлайн должен быть в будущем'; end if;
 if p_timezone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=p_timezone) then raise exception 'Неверный часовой пояс'; end if;
 if p_type='binary' then
  if p_event_date is null or (p_deadline_at at time zone p_timezone)::date > p_event_date then raise exception 'Дедлайн позже даты события'; end if;
 elsif p_event_date is not null then raise exception 'Дата события нужна только для Да / Нет'; end if;
 if p_type='multi' then
  if p_options is null or jsonb_typeof(p_options)<>'array' or jsonb_array_length(p_options) < 2 or jsonb_array_length(p_options)>20 then raise exception 'Нужно от 2 до 20 вариантов'; end if;
  labels:=array[]::text[];
  for item in select jsonb_array_elements_text(p_options) loop
   if length(trim(item)) not between 1 and 160 or lower(trim(item))=any(labels) then raise exception 'Варианты должны быть заполнены и не повторяться'; end if;
   labels:=array_append(labels,lower(trim(item)));
  end loop;
 end if;
 insert into public.pari(creator_id,type,title,condition,event_date,deadline_at,timezone,hidden_answers)
 values(auth.uid(),p_type,trim(p_title),trim(p_condition),p_event_date,p_deadline_at,p_timezone,coalesce(p_hidden_answers,true)) returning id into new_id;
 if p_type='binary' then
  insert into public.pari_options(pari_id,label,position) values(new_id,'Да',0),(new_id,'Нет',1);
 elsif p_type='multi' then
  for n in 0..jsonb_array_length(p_options)-1 loop
   insert into public.pari_options(pari_id,label,position) values(new_id,trim(p_options->>n),n);
  end loop;
 end if;
 return new_id;
end $$;

create function public.list_pari() returns table(id uuid,title text,condition text,type text,deadline_at timestamptz,timezone text,status text,hidden_answers boolean,creator_name text,answer_count bigint)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 return query select p.id,p.title,p.condition,p.type,p.deadline_at,p.timezone,
  case when p.status='open' and p.deadline_at<=clock_timestamp() then 'awaiting_result' else p.status end,
  p.hidden_answers,pr.display_name,
  case when p.hidden_answers and p.deadline_at>clock_timestamp() then null::bigint else (select count(*) from public.pari_answers a where a.pari_id=p.id) end
 from public.pari p join public.profiles pr on pr.id=p.creator_id where p.status<>'draft'
 order by p.created_at desc limit 200;
end $$;

create function public.get_pari(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.pari; payload jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select * into p from public.pari where id=p_id and (status<>'draft' or creator_id=auth.uid());
 if not found then raise exception 'Пари не найдено'; end if;
 payload:=jsonb_build_object('id',p.id,'type',p.type,'title',p.title,'condition',p.condition,'event_date',p.event_date,'deadline_at',p.deadline_at,'timezone',p.timezone,'hidden_answers',p.hidden_answers,
  'status',case when p.status='open' and p.deadline_at<=clock_timestamp() then 'awaiting_result' else p.status end,
  'creator_id',p.creator_id,'result_option_id',p.result_option_id,'result_text',p.result_text,
  'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label) order by o.position) from public.pari_options o where o.pari_id=p.id),'[]'::jsonb),
  'my_answer',(select jsonb_build_object('option_id',a.option_id,'free_text',a.free_text,'created_at',a.created_at) from public.pari_answers a where a.pari_id=p.id and a.user_id=auth.uid()));
 if not p.hidden_answers or p.deadline_at<=clock_timestamp() then
  payload:=payload||jsonb_build_object('answers',coalesce((select jsonb_agg(jsonb_build_object('option_id',a.option_id,'free_text',a.free_text,'created_at',a.created_at,'name',pr.display_name) order by a.created_at) from public.pari_answers a join public.profiles pr on pr.id=a.user_id where a.pari_id=p.id),'[]'::jsonb));
 end if;
 return payload;
end $$;

create function public.submit_pari_answer(p_id uuid,p_option_id uuid,p_free_text text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.pari; answer_id uuid;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select * into p from public.pari where id=p_id for update;
 if not found or p.status<>'open' or p.deadline_at<=clock_timestamp() then raise exception 'Приём ответов завершён'; end if;
 if p.type='free' then
  if p_option_id is not null or length(trim(coalesce(p_free_text,''))) not between 1 and 1000 then raise exception 'Введите ответ'; end if;
 else
  if p_free_text is not null or p_option_id is null or not exists(select 1 from public.pari_options o where o.id=p_option_id and o.pari_id=p_id) then raise exception 'Выберите вариант этого пари'; end if;
 end if;
 insert into public.pari_answers(pari_id,user_id,option_id,free_text) values(p_id,auth.uid(),p_option_id,case when p.type='free' then trim(p_free_text) else null end) returning id into answer_id;
 return answer_id;
end $$;

create function public.finish_pari(p_id uuid,p_option_id uuid,p_result_text text) returns void
language plpgsql security definer set search_path='' as $$
declare p public.pari;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select * into p from public.pari where id=p_id for update;
 if not found or p.creator_id<>auth.uid() then raise insufficient_privilege; end if;
 if p.status<>'open' or p.deadline_at>clock_timestamp() then raise exception 'Пари ещё принимает ответы или уже завершено'; end if;
 if p.type='free' then
  if p_option_id is not null or length(trim(coalesce(p_result_text,''))) not between 1 and 1000 then raise exception 'Укажите результат'; end if;
 else
  if p_result_text is not null or p_option_id is null or not exists(select 1 from public.pari_options where id=p_option_id and pari_id=p_id) then raise exception 'Выберите результат этого пари'; end if;
 end if;
 update public.pari set status='completed',result_option_id=p_option_id,result_text=case when p.type='free' then trim(p_result_text) else null end where id=p_id;
end $$;
revoke all on function public.create_pari(text,text,text,date,timestamptz,text,boolean,jsonb),public.list_pari(),public.get_pari(uuid),public.submit_pari_answer(uuid,uuid,text),public.finish_pari(uuid,uuid,text) from public;
grant execute on function public.create_pari(text,text,text,date,timestamptz,text,boolean,jsonb),public.list_pari(),public.get_pari(uuid),public.submit_pari_answer(uuid,uuid,text),public.finish_pari(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
