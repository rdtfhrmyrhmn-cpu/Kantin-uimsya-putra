-- KANTIN UIMSYA PUTRA - SUPABASE DATABASE
-- Jalankan di Supabase Dashboard > SQL Editor

create table if not exists public.finance_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"harian":{}, "pengeluaran":[], "penarikan":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.finance_data enable row level security;

drop policy if exists "Users can read own finance data" on public.finance_data;
create policy "Users can read own finance data"
on public.finance_data for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own finance data" on public.finance_data;
create policy "Users can insert own finance data"
on public.finance_data for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own finance data" on public.finance_data;
create policy "Users can update own finance data"
on public.finance_data for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Opsional: otomatis mengisi updated_at
create or replace function public.set_finance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists finance_data_updated_at on public.finance_data;
create trigger finance_data_updated_at
before update on public.finance_data
for each row execute function public.set_finance_updated_at();

-- ═══════════════════════════════════════════
-- AKUN & ROLE ADMIN
-- ═══════════════════════════════════════════
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
for select to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Setelah membuat akun admin pertama melalui setup.html,
-- jalankan SQL berikut dengan mengganti 'admin' jika perlu:
-- update public.profiles set role='admin' where username='admin';

create or replace function public.claim_first_admin()
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    return false;
  end if;
  update public.profiles set role = 'admin' where id = auth.uid();
  return found;
end;
$$;
grant execute on function public.claim_first_admin() to authenticated;
