-- Invoice unit traceability and reversible recovery for invoices and payments.

alter table public.partner_invoices
add column if not exists voided_at timestamptz,
add column if not exists voided_by uuid references public.profiles(id) on delete set null,
add column if not exists void_reason text,
add column if not exists restored_at timestamptz,
add column if not exists restored_by uuid references public.profiles(id) on delete set null;

alter table public.invoice_runs
add column if not exists voided_at timestamptz,
add column if not exists voided_by uuid references public.profiles(id) on delete set null,
add column if not exists void_reason text;

alter table public.partner_invoice_payments
add column if not exists voided_at timestamptz,
add column if not exists voided_by uuid references public.profiles(id) on delete set null,
add column if not exists void_reason text;

alter table public.financial_income_records
add column if not exists voided_at timestamptz,
add column if not exists voided_by uuid references public.profiles(id) on delete set null,
add column if not exists void_reason text;

create table if not exists public.production_unit_invoice_links (
  id uuid primary key default gen_random_uuid(),
  production_unit_id uuid not null references public.production_units(id) on delete cascade,
  invoice_id uuid not null references public.partner_invoices(id) on delete cascade,
  invoice_line_id uuid references public.partner_invoice_lines(id) on delete set null,
  invoice_run_id uuid references public.invoice_runs(id) on delete set null,
  partner_id uuid not null references public.partners(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  work_date date not null,
  quantity integer not null check (quantity >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null,
  release_reason text
);

create unique index if not exists production_unit_invoice_links_active_unit_idx
on public.production_unit_invoice_links(production_unit_id)
where released_at is null;

create index if not exists production_unit_invoice_links_invoice_idx
on public.production_unit_invoice_links(invoice_id, released_at);

create index if not exists production_unit_invoice_links_worker_date_idx
on public.production_unit_invoice_links(worker_id, work_date, released_at);

alter table public.production_unit_invoice_links enable row level security;

drop policy if exists "Admins can manage production unit invoice links"
on public.production_unit_invoice_links;
create policy "Admins can manage production unit invoice links"
on public.production_unit_invoice_links
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.invoice_recovery_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('invoice_voided', 'payment_voided', 'unit_links_released')),
  invoice_id uuid references public.partner_invoices(id) on delete set null,
  invoice_payment_id uuid references public.partner_invoice_payments(id) on delete set null,
  invoice_run_id uuid references public.invoice_runs(id) on delete set null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_recovery_events_invoice_idx
on public.invoice_recovery_events(invoice_id, created_at desc);

alter table public.invoice_recovery_events enable row level security;

drop policy if exists "Admins can manage invoice recovery events"
on public.invoice_recovery_events;
create policy "Admins can manage invoice recovery events"
on public.invoice_recovery_events
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
