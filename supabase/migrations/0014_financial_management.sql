-- Financial management foundation for income, expenses, and reports.

create table if not exists public.financial_income_records (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'manual'
    check (source in ('invoice_payment', 'manual')),
  partner_id uuid references public.partners(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  invoice_id uuid references public.partner_invoices(id) on delete set null,
  invoice_payment_id uuid unique references public.partner_invoice_payments(id) on delete cascade,
  invoice_number text,
  income_date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text,
  deposit_account text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_income_invoice_source_check
    check (
      source = 'manual'
      or (source = 'invoice_payment' and invoice_payment_id is not null)
    )
);

create index if not exists financial_income_date_idx
on public.financial_income_records(income_date desc);

create index if not exists financial_income_partner_idx
on public.financial_income_records(partner_id, income_date desc);

create index if not exists financial_income_client_idx
on public.financial_income_records(client_id, income_date desc);

drop trigger if exists financial_income_records_set_updated_at
on public.financial_income_records;
create trigger financial_income_records_set_updated_at
before update on public.financial_income_records
for each row
execute function public.set_updated_at();

alter table public.financial_income_records enable row level security;

drop policy if exists "Admins can manage financial income records"
on public.financial_income_records;
create policy "Admins can manage financial income records"
on public.financial_income_records
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.financial_income_records (
  source,
  partner_id,
  client_id,
  invoice_id,
  invoice_payment_id,
  invoice_number,
  income_date,
  amount,
  payment_method,
  deposit_account,
  notes
)
select
  'invoice_payment',
  payment.partner_id,
  invoice.client_id,
  payment.invoice_id,
  payment.id,
  invoice.invoice_number,
  payment.date_received,
  payment.amount_received,
  payment.payment_method,
  payment.deposit_account,
  payment.notes
from public.partner_invoice_payments payment
join public.partner_invoices invoice on invoice.id = payment.invoice_id
on conflict (invoice_payment_id) do update
set
  partner_id = excluded.partner_id,
  client_id = excluded.client_id,
  invoice_id = excluded.invoice_id,
  invoice_number = excluded.invoice_number,
  income_date = excluded.income_date,
  amount = excluded.amount,
  payment_method = excluded.payment_method,
  deposit_account = excluded.deposit_account,
  notes = excluded.notes;

create table if not exists public.financial_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default current_date,
  vendor text not null,
  category text not null
    check (category in (
      'payroll',
      'office_expenses',
      'software',
      'banking_payment_fees',
      'professional_services',
      'taxes_government'
    )),
  subcategory text,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method text,
  paid_from_account text,
  partner_id uuid references public.partners(id) on delete set null,
  worker_id uuid references public.profiles(id) on delete set null,
  receipt_file_name text,
  receipt_storage_path text,
  tax_deductible boolean not null default true,
  notes text,
  recurring boolean not null default false,
  recurring_frequency text check (
    recurring_frequency is null
    or recurring_frequency in ('weekly', 'monthly', 'quarterly', 'yearly')
  ),
  recurring_next_date date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_expenses_date_idx
on public.financial_expenses(expense_date desc);

create index if not exists financial_expenses_category_idx
on public.financial_expenses(category, expense_date desc);

create index if not exists financial_expenses_partner_idx
on public.financial_expenses(partner_id, expense_date desc);

create index if not exists financial_expenses_vendor_idx
on public.financial_expenses(vendor);

drop trigger if exists financial_expenses_set_updated_at
on public.financial_expenses;
create trigger financial_expenses_set_updated_at
before update on public.financial_expenses
for each row
execute function public.set_updated_at();

alter table public.financial_expenses enable row level security;

drop policy if exists "Admins can manage financial expenses"
on public.financial_expenses;
create policy "Admins can manage financial expenses"
on public.financial_expenses
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', false)
on conflict (id) do nothing;

drop policy if exists "Admins can manage expense receipts"
on storage.objects;
create policy "Admins can manage expense receipts"
on storage.objects
for all
to authenticated
using (bucket_id = 'expense-receipts' and public.is_admin())
with check (bucket_id = 'expense-receipts' and public.is_admin());
