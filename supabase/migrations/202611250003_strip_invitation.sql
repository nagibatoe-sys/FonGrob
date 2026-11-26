begin;
create function public.strip_invitation_metadata() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.raw_user_meta_data := new.raw_user_meta_data - 'invitation';
  return new;
end $$;
create trigger strip_invitation_metadata before update of raw_user_meta_data on auth.users
for each row when (new.raw_user_meta_data ? 'invitation') execute function public.strip_invitation_metadata();
update auth.users set raw_user_meta_data = raw_user_meta_data - 'invitation'
where raw_user_meta_data ? 'invitation';
commit;
