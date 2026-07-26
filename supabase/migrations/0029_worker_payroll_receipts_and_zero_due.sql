alter table public.payroll_payments
add column if not exists receipt_number text,
add column if not exists receipt_generated_at timestamptz,
add column if not exists receipt_notes text;

create unique index if not exists payroll_payments_receipt_number_unique
on public.payroll_payments(receipt_number)
where receipt_number is not null;

update public.payroll_payments
set
  receipt_number = 'WPR-' || upper(left(id::text, 8)),
  receipt_generated_at = coalesce(receipt_generated_at, created_at)
where receipt_number is null;

update public.worker_payrolls
set
  status = 'paid',
  balance_remaining = 0,
  total_paid = 0,
  updated_at = now()
where total_owed = 0
  and status in ('due', 'partial');
