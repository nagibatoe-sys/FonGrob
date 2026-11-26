begin;
create function public.admin_users() returns table(id uuid, login text, display_name text, created_at timestamptz, roles text[])
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  return query select u.id, split_part(u.email, '@', 1), p.display_name, u.created_at,
    coalesce(array_agg(r.role_code) filter (where r.role_code is not null), array[]::text[])
  from auth.users u join public.profiles p on p.id = u.id
  left join public.user_roles r on r.profile_id = u.id
  group by u.id, u.email, p.display_name, u.created_at order by u.created_at desc;
end $$;
revoke all on function public.admin_users() from public;
grant execute on function public.admin_users() to authenticated;

create function public.admin_invite(p_login text, p_token_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise insufficient_privilege; end if;
  if p_login !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then raise exception 'Invalid login'; end if;
  if exists(select 1 from auth.users where email = p_login || '@accounts.fongrob.invalid') then
    raise unique_violation using message = 'Login already exists';
  end if;
  insert into public.invitations(token_hash, email, expires_at)
  values (decode(p_token_hash, 'hex'), p_login || '@accounts.fongrob.invalid', now() + interval '5 minutes');
end $$;
revoke all on function public.admin_invite(text,text) from public;
grant execute on function public.admin_invite(text,text) to authenticated;
commit;
