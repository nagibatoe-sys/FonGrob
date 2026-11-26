begin;
create table public.roles (code text primary key);
insert into public.roles values ('PLAYER'), ('ORGANIZER'), ('TRADER'), ('MODERATOR'), ('JUDGE'), ('RISK_MANAGER'), ('ADMIN'), ('SUPER_ADMIN');
create table public.permissions (code text primary key);
create table public.role_permissions (
  role_code text references public.roles, permission_code text references public.permissions,
  primary key(role_code, permission_code)
);
create table public.user_roles (
  profile_id uuid references public.profiles, role_code text references public.roles,
  primary key(profile_id, role_code)
);
insert into public.permissions values ('issue_invitation');
insert into public.role_permissions values ('ADMIN','issue_invitation'), ('SUPER_ADMIN','issue_invitation');
create table public.invitations (
  token_hash bytea primary key,
  email text not null check (email = lower(trim(email)) and email <> ''),
  expires_at timestamptz not null,
  issued_by uuid references public.profiles,
  used_by uuid unique references public.profiles
);
create table public.economy_settings (
  singleton boolean primary key check(singleton),
  opening_credit numeric(16,2) not null check(opening_credit > 0 and opening_credit <> 'NaN')
);
insert into public.economy_settings values (true,1000);
create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.wallets,
  operation_key text not null,
  amount numeric(16,2) not null check(amount <> 0 and amount <> 'NaN'),
  created_at timestamptz not null default now(),
  unique(profile_id, operation_key)
);
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.invitations enable row level security;
alter table public.economy_settings enable row level security;
alter table public.wallet_transactions enable row level security;
revoke all on public.roles, public.permissions, public.role_permissions, public.user_roles,
  public.invitations, public.economy_settings, public.wallet_transactions from public, anon, authenticated;
grant select on public.user_roles, public.wallet_transactions to authenticated;
create policy own_roles on public.user_roles for select to authenticated using(profile_id = (select auth.uid()));
create policy own_history on public.wallet_transactions for select to authenticated using(profile_id = (select auth.uid()));

create function public.issue_invitation(recipient text) returns text
language plpgsql security definer set search_path = '' as $$
declare token text := gen_random_uuid()::text;
begin
  if not exists(select 1 from public.user_roles u join public.role_permissions p using(role_code)
    where u.profile_id = auth.uid() and p.permission_code = 'issue_invitation') then
    raise insufficient_privilege;
  end if;
  insert into public.invitations(token_hash,email,expires_at,issued_by)
  values(sha256(convert_to(token,'UTF8')),lower(trim(recipient)),now()+interval '7 days',auth.uid());
  return token;
end $$;
revoke all on function public.issue_invitation(text) from public, anon, authenticated;
grant execute on function public.issue_invitation(text) to authenticated;

create function public.register_office_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare invitation public.invitations;
declare credit numeric;
begin
  select * into invitation from public.invitations
    where token_hash = sha256(convert_to(new.raw_user_meta_data->>'invitation','UTF8'))
      and email = lower(new.email) and expires_at > clock_timestamp() and used_by is null
    for update;
  if not found then raise exception 'Приглашение недействительно'; end if;
  insert into public.profiles(id, display_name) values(new.id, trim(new.raw_user_meta_data->>'display_name'));
  update public.invitations set used_by = new.id where token_hash = invitation.token_hash;
  insert into public.user_roles values(new.id,'PLAYER');
  select opening_credit into strict credit from public.economy_settings where singleton;
  insert into public.wallets values(new.id,credit);
  insert into public.wallet_transactions(profile_id,operation_key,amount) values(new.id,'opening',credit);
  update auth.users set raw_user_meta_data = raw_user_meta_data - 'invitation' where id = new.id;
  return new;
end $$;
revoke all on function public.register_office_member() from public, anon, authenticated;
create trigger register_office_member after insert on auth.users for each row execute function public.register_office_member();
commit;
