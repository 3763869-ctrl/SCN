-- Unit approval locks for billing periods and manual invoice lines.

create table if not exists public.production_unit_periods (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'completed'
    check (status in ('completed', 'reopened')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_unit_periods_date_order
    check (period_end >= period_start),
  constraint production_unit_periods_worker_period_unique
    unique (worker_id, period_start, period_end)
);

create index if not exists production_unit_periods_worker_period_idx
on public.production_unit_periods(worker_id, period_start desc, status);

drop trigger if exists production_unit_periods_set_updated_at
on public.production_unit_periods;
create trigger production_unit_periods_set_updated_at
before update on public.production_unit_periods
for each row
execute function public.set_updated_at();

alter table public.production_unit_periods enable row level security;

drop policy if exists "Admins can manage production unit periods"
on public.production_unit_periods;
create policy "Admins can manage production unit periods"
on public.production_unit_periods
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.partner_invoice_lines
add column if not exists source text not null default 'generated'
  check (source in ('generated', 'manual'));
