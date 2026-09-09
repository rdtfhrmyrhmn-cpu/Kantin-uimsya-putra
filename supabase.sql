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

-- V10 PROFESSIONAL CORE
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('income','expense')),
  icon text default '📁',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('income','expense','withdrawal','deposit','transfer','adjustment')),
  category_id uuid references public.categories(id) on delete set null,
  description text not null,
  amount numeric(18,2) not null check (amount >= 0),
  payment_method text default 'cash',
  reference_number text,
  status text not null default 'approved' check (status in ('draft','pending','approved','rejected','cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  target_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.closed_periods (
  period_key text primary key,
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz not null default now()
);
create index if not exists transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index if not exists transactions_status_idx on public.transactions(status);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.closed_periods enable row level security;

drop policy if exists "Authenticated can read categories" on public.categories;
create policy "Authenticated can read categories" on public.categories for select to authenticated using (true);
drop policy if exists "Authenticated can manage categories" on public.categories;
create policy "Authenticated can manage categories" on public.categories for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "Users can read own transactions" on public.transactions;
create policy "Users can read own transactions" on public.transactions for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "Users can insert transactions" on public.transactions;
create policy "Users can insert transactions" on public.transactions for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "Users can update transactions" on public.transactions;
create policy "Users can update transactions" on public.transactions for update to authenticated using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "Users can delete transactions" on public.transactions;
create policy "Users can delete transactions" on public.transactions for delete to authenticated using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists "Users can read audit logs" on public.audit_logs;
create policy "Users can read audit logs" on public.audit_logs for select to authenticated using (user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "Users can insert audit logs" on public.audit_logs;
create policy "Users can insert audit logs" on public.audit_logs for insert to authenticated with check (user_id=auth.uid());

drop policy if exists "Authenticated can read closed periods" on public.closed_periods;
create policy "Authenticated can read closed periods" on public.closed_periods for select to authenticated using (true);
drop policy if exists "Admin can manage closed periods" on public.closed_periods;
create policy "Admin can manage closed periods" on public.closed_periods for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

-- Expand roles for V10 (safe conversion from v9 admin/user)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','bendahara','petugas','viewer','user'));

insert into public.categories(name,type,icon) values
('Penjualan','income','💰'),('Pendapatan Lain','income','📥'),('Belanja','expense','🛒'),('Operasional','expense','⚙️'),('Listrik & Air','expense','💡'),('Transportasi','expense','🚚'),('Perawatan','expense','🔧'),('Lainnya','expense','📦')
on conflict do nothing;
