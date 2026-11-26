begin;
alter table public.events add column category text not null default 'special'
 check (category in ('meetings','it','kitchen','accounting','sales','logistics','teams','corporate','weather','special'));
create index events_line_category_idx on public.events (category, closes_at) where status = 'open';
create function public.propose_categorized_event(title text, rules text, closes_at timestamptz, category text) returns uuid
language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 if category not in ('meetings','it','kitchen','accounting','sales','logistics','teams','corporate','weather','special') then
  raise exception 'Неизвестная категория';
 end if;
 eid := public.propose_event(title,rules,closes_at);
 update public.events set category=propose_categorized_event.category where id=eid;
 return eid;
end $$;
revoke all on function public.propose_categorized_event(text,text,timestamptz,text) from public;
grant execute on function public.propose_categorized_event(text,text,timestamptz,text) to authenticated;
notify pgrst,'reload schema';
commit;
