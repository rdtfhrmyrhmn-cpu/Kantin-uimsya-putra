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


-- ═══════════════════════════════════════════
-- V10.1 HARDENING / PRODUCTION RULES
-- ═══════════════════════════════════════════
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

-- Admin dapat membaca profil seluruh pengguna; user biasa tetap hanya profil sendiri.
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admin can read all profiles" on public.profiles;
create policy "Users can read own profile" on public.profiles
for select to authenticated using (auth.uid() = id);
create policy "Admin can read all profiles" on public.profiles
for select to authenticated using (public.is_admin());

-- Kolom audit sumber untuk migrasi legacy tanpa duplikasi.
alter table public.transactions add column if not exists source_key text;
create unique index if not exists transactions_source_key_uidx
on public.transactions(source_key) where source_key is not null;

-- Periode tertutup wajib ditegakkan di database, bukan hanya UI.
create or replace function public.enforce_open_period_transaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  period_key text;
  actor uuid := auth.uid();
begin
  if public.is_admin() then if TG_OP='DELETE' then return old; else return new; end if; end if;
  period_key := to_char(coalesce(new.transaction_date, old.transaction_date), 'YYYY-MM');
  if exists(select 1 from public.closed_periods where closed_periods.period_key = period_key) then
    raise exception 'PERIODE_TERTUTUP:%', period_key using errcode='P0001';
  end if;
  if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists transactions_open_period_guard on public.transactions;
create trigger transactions_open_period_guard
before insert or update or delete on public.transactions
for each row execute function public.enforce_open_period_transaction();

-- Audit log otomatis untuk perubahan transaksi.
create or replace function public.audit_transaction_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(user_id, action, target, target_id, old_value, new_value)
  values (
    auth.uid(),
    case when TG_OP='INSERT' then 'TRANSAKSI_CREATED'
         when TG_OP='UPDATE' then 'TRANSAKSI_UPDATED'
         when TG_OP='DELETE' then 'TRANSAKSI_DELETED' end,
    'transactions',
    coalesce(new.id, old.id)::text,
    case when TG_OP='INSERT' then null else to_jsonb(old) end,
    case when TG_OP='DELETE' then null else to_jsonb(new) end
  );
  if TG_OP='DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists transactions_audit_trigger on public.transactions;
create trigger transactions_audit_trigger
after insert or update or delete on public.transactions
for each row execute function public.audit_transaction_change();

-- Audit dan transaksi: Admin dapat melihat seluruh data; user tetap terbatas pada miliknya.
drop policy if exists "Users can read audit logs" on public.audit_logs;
create policy "Users can read audit logs" on public.audit_logs
for select to authenticated using (user_id=auth.uid() or public.is_admin());

-- RPC migrasi aman untuk data V9 yang memiliki pengeluaran/penarikan.
create or replace function public.migrate_legacy_finance_data()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  f record; item jsonb; n integer := 0; k text; d date; amount numeric; desc_text text;
begin
  if not public.is_admin() then raise exception 'Hanya admin yang dapat menjalankan migrasi.'; end if;
  for f in select user_id, data from public.finance_data loop
    for item in select * from jsonb_array_elements(coalesce(f.data->'pengeluaran','[]'::jsonb)) loop
      d := nullif(item->>'tgl','')::date;
      amount := coalesce((item->>'total')::numeric,0);
      desc_text := coalesce(item->>'keterangan','Pengeluaran legacy V9');
      if d is not null and amount > 0 then
        k := 'v9:pengeluaran:'||f.user_id::text||':'||coalesce(item->>'id', md5(item::text));
        insert into public.transactions(user_id,transaction_date,transaction_type,description,amount,payment_method,status,source_key,created_by)
        values(f.user_id,d,'expense',desc_text,amount,'cash','approved',k,f.user_id)
        on conflict (source_key) do nothing;
        if found then n := n+1; end if;
      end if;
    end loop;
    for item in select * from jsonb_array_elements(coalesce(f.data->'penarikan','[]'::jsonb)) loop
      d := nullif(item->>'tgl','')::date;
      amount := coalesce((item->>'jumlah')::numeric,0);
      desc_text := coalesce(item->>'keterangan','Penarikan legacy V9');
      if d is not null and amount > 0 then
        k := 'v9:penarikan:'||f.user_id::text||':'||coalesce(item->>'id', md5(item::text));
        insert into public.transactions(user_id,transaction_date,transaction_type,description,amount,payment_method,status,source_key,created_by)
        values(f.user_id,d,'withdrawal',desc_text,amount,'cash','approved',k,f.user_id)
        on conflict (source_key) do nothing;
        if found then n := n+1; end if;
      end if;
    end loop;
  end loop;
  return n;
end;
$$;
grant execute on function public.migrate_legacy_finance_data() to authenticated;

drop policy if exists "Admin can manage profiles" on public.profiles;
create policy "Admin can manage profiles" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Admin/bendahara dapat memproses transaksi, tetapi hanya Admin yang mengelola periode.
