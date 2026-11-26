begin;
grant select on public.departments to authenticated;
create policy department_directory on public.departments for select to authenticated using (true);
grant update (display_name, department_id) on public.profiles to authenticated;
create policy edit_own_profile on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
notify pgrst, 'reload schema';
commit;
