-- Flat Partner payroll created from active Partner invoices.

create table if not exists public.partner_pay_settings (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  flat_pay_per_invoice numeric(10, 2) not null default 0 check (flat_pay_per_invoice >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists partner_pay_settings_set_updated_at
on public.partner_pay_settings;
create trigger partner_pay_settings_set_updated_at
before update on public.partner_pay_settings
for each row
execute function public.set_updated_at();

alter table public.partner_pay_settings enable row level security;

drop policy if exists "Admins can manage partner pay settings"
on public.partner_pay_settings;
create policy "Admins can manage partner pay settings"
on public.partner_pay_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.partner_payrolls (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  invoice_id uuid unique references public.partner_invoices(id) on delete set null,
  billing_period_start date not null,
  billing_period_end date not null,
  flat_pay_snapshot numeric(10, 2) not null default 0 check (flat_pay_snapshot >= 0),
  total_owed numeric(10, 2) not null default 0 check (total_owed >= 0),
  total_paid numeric(10, 2) not null default 0 check (total_paid >= 0),
  balance_remaining numeric(10, 2) not null default 0 check (balance_remaining >= 0),
  status text not null default 'due'
    check (status in ('due', 'partial', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_payrolls_period_order
    check (billing_period_end >= billing_period_start)
);

create index if not exists partner_payrolls_partner_status_idx
on public.partner_payrolls(partner_id, status, billing_period_start desc);

drop trigger if exists partner_payrolls_set_updated_at
on public.partner_payrolls;
create trigger partner_payrolls_set_updated_at
before update on public.partner_payrolls
for each row
execute function public.set_updated_at();

alter table public.partner_payrolls enable row level security;

drop policy if exists "Admins can manage partner payrolls"
on public.partner_payrolls;
create policy "Admins can manage partner payrolls"
on public.partner_payrolls
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.partner_payroll_payments (
  id uuid primary key default gen_random_uuid(),
  partner_payroll_id uuid not null references public.partner_payrolls(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  paid_at date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists partner_payroll_payments_payroll_idx
on public.partner_payroll_payments(partner_payroll_id, paid_at desc);

alter table public.partner_payroll_payments enable row level security;

drop policy if exists "Admins can manage partner payroll payments"
on public.partner_payroll_payments;
create policy "Admins can manage partner payroll payments"
on public.partner_payroll_payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
