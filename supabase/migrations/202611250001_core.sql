begin;
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0)
);
create table public.profiles (
  id uuid primary key references auth.users(id),
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  department_id uuid references public.departments(id)
);
create table public.wallets (
  profile_id uuid primary key references public.profiles(id),
  balance numeric(16,2) not null default 0 check (balance >= 0 and balance <> 'NaN')
);
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
create policy wallet_owner_read on public.wallets for select to authenticated using (profile_id = (select auth.uid()));
create policy profile_owner_read on public.profiles for select to authenticated using (id = (select auth.uid()));
revoke all on public.departments, public.profiles, public.wallets from public, anon, authenticated;
grant select on public.wallets, public.profiles to authenticated;
commit;
