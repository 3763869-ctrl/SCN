-- Weekly timesheet completion and payroll payment tracking.

create type public.timesheet_week_status as enum ('open', 'completed', 'reopened');
create type public.worker_payroll_status as enum ('due', 'partial', 'paid', 'reopened');

create table public.timesheet_weeks (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  status public.timesheet_week_status not null default 'open',
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timesheet_weeks_worker_week_unique unique (worker_id, week_start),
  constraint timesheet_weeks_week_order check (week_end >= week_start)
);

create index timesheet_weeks_worker_week_idx
on public.timesheet_weeks(worker_id, week_start desc);

create trigger timesheet_weeks_set_updated_at
before update on public.timesheet_weeks
for each row
execute function public.set_updated_at();

alter table public.timesheet_weeks enable row level security;

create policy "Workers can read own timesheet weeks and admins can read all"
on public.timesheet_weeks
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Admins can manage timesheet weeks"
on public.timesheet_weeks
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table public.worker_payrolls (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  timesheet_week_id uuid not null references public.timesheet_weeks(id) on delete cascade,
  week_start date not null,
  week_end date not null,
  due_date date not null,
  total_hours numeric(10, 2) not null default 0,
  total_units integer not null default 0,
  hourly_rate numeric(10, 2) not null default 0,
  hourly_pay numeric(10, 2) not null default 0,
  bonus_pay numeric(10, 2) not null default 0,
  total_owed numeric(10, 2) not null default 0,
  total_paid numeric(10, 2) not null default 0,
  balance_remaining numeric(10, 2) not null default 0,
  status public.worker_payroll_status not null default 'due',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_payrolls_week_unique unique (worker_id, week_start),
  constraint worker_payrolls_amounts_nonnegative check (
    total_hours >= 0
    and total_units >= 0
    and hourly_rate >= 0
    and hourly_pay >= 0
    and bonus_pay >= 0
    and total_owed >= 0
    and total_paid >= 0
    and balance_remaining >= 0
  )
);

create index worker_payrolls_status_due_idx
on public.worker_payrolls(status, due_date);

create index worker_payrolls_worker_week_idx
on public.worker_payrolls(worker_id, week_start desc);

create trigger worker_payrolls_set_updated_at
before update on public.worker_payrolls
for each row
execute function public.set_updated_at();

alter table public.worker_payrolls enable row level security;

create policy "Workers can read own payrolls and admins can read all"
on public.worker_payrolls
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Admins can manage payrolls"
on public.worker_payrolls
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.worker_payrolls(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  paid_at date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index payroll_payments_payroll_idx
on public.payroll_payments(payroll_id, paid_at desc);

create index payroll_payments_worker_paid_idx
on public.payroll_payments(worker_id, paid_at desc);

alter table public.payroll_payments enable row level security;

create policy "Workers can read own payroll payments and admins can read all"
on public.payroll_payments
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Admins can manage payroll payments"
on public.payroll_payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
