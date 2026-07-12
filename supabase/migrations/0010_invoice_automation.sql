-- Automated Partner invoice generation and payment tracking.

do $$
begin
  alter type public.partner_invoice_status add value if not exists 'partial';
exception
  when duplicate_object then null;
end $$;

create table if not exists public.partner_billing_settings (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  rate_per_unit numeric(10, 2) not null default 0 check (rate_per_unit >= 0),
  billing_frequency text not null default 'semi_monthly'
    check (billing_frequency in ('semi_monthly', 'manual')),
  payment_terms_days integer not null default 15 check (payment_terms_days >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists partner_billing_settings_set_updated_at
on public.partner_billing_settings;
create trigger partner_billing_settings_set_updated_at
before update on public.partner_billing_settings
for each row
execute function public.set_updated_at();

alter table public.partner_billing_settings enable row level security;

drop policy if exists "Admins can manage partner billing settings"
on public.partner_billing_settings;
create policy "Admins can manage partner billing settings"
on public.partner_billing_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.invoice_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  billing_period_start date not null,
  billing_period_end date not null,
  status text not null default 'ready'
    check (status in ('ready', 'sent', 'closed', 'cancelled')),
  invoice_count integer not null default 0 check (invoice_count >= 0),
  total_units integer not null default 0 check (total_units >= 0),
  total_amount numeric(10, 2) not null default 0 check (total_amount >= 0),
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_runs_period_order
    check (billing_period_end >= billing_period_start),
  constraint invoice_runs_unique_period unique (
    client_id,
    billing_period_start,
    billing_period_end
  )
);

create index if not exists invoice_runs_status_period_idx
on public.invoice_runs(status, billing_period_start desc);

drop trigger if exists invoice_runs_set_updated_at on public.invoice_runs;
create trigger invoice_runs_set_updated_at
before update on public.invoice_runs
for each row
execute function public.set_updated_at();

alter table public.invoice_runs enable row level security;

drop policy if exists "Admins can manage invoice runs"
on public.invoice_runs;
create policy "Admins can manage invoice runs"
on public.invoice_runs
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.partner_invoices
add column if not exists invoice_run_id uuid references public.invoice_runs(id) on delete set null,
add column if not exists total_paid numeric(10, 2) not null default 0 check (total_paid >= 0),
add column if not exists balance_remaining numeric(10, 2) not null default 0 check (balance_remaining >= 0),
add column if not exists generated_at timestamptz;

update public.partner_invoices invoice
set
  total_paid = coalesce(payment_totals.total_paid, 0),
  balance_remaining = greatest(invoice.invoice_total - coalesce(payment_totals.total_paid, 0), 0)
from (
  select invoice_id, sum(amount_received) as total_paid
  from public.partner_invoice_payments
  group by invoice_id
) payment_totals
where invoice.id = payment_totals.invoice_id;

update public.partner_invoices
set balance_remaining = invoice_total
where balance_remaining = 0
  and total_paid = 0
  and status not in ('paid', 'cancelled');

create unique index if not exists partner_invoice_unique_active_period_idx
on public.partner_invoices(partner_id, billing_period_start, billing_period_end)
where status <> 'cancelled';

create index if not exists partner_invoices_run_idx
on public.partner_invoices(invoice_run_id);

create table if not exists public.partner_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.partner_invoices(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  worker_id uuid references public.profiles(id) on delete set null,
  work_date date,
  description text not null,
  units integer not null default 0 check (units >= 0),
  rate_per_unit numeric(10, 2) not null default 0 check (rate_per_unit >= 0),
  line_total numeric(10, 2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists partner_invoice_lines_invoice_idx
on public.partner_invoice_lines(invoice_id, work_date);

alter table public.partner_invoice_lines enable row level security;

drop policy if exists "Admins can manage partner invoice lines"
on public.partner_invoice_lines;
create policy "Admins can manage partner invoice lines"
on public.partner_invoice_lines
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
