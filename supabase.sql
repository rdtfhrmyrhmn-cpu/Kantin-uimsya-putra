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
