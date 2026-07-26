alter table public.financial_expenses
add column if not exists payroll_payment_id uuid references public.payroll_payments(id) on delete set null;

create unique index if not exists financial_expenses_payroll_payment_unique
on public.financial_expenses(payroll_payment_id)
where payroll_payment_id is not null;

insert into public.financial_expenses (
  payroll_payment_id,
  expense_date,
  vendor,
  category,
  subcategory,
  description,
  amount,
  worker_id,
  tax_deductible,
  notes,
  recurring,
  created_by
)
select
  payment.id,
  payment.paid_at,
  coalesce(profile.full_name, profile.email, 'Worker Payroll'),
  'payroll',
  'Philippines Payroll',
  'Worker payroll payment for week ' || payroll.week_start || ' to ' || payroll.week_end,
  payment.amount,
  payment.worker_id,
  true,
  payment.notes,
  false,
  payment.created_by
from public.payroll_payments payment
join public.worker_payrolls payroll on payroll.id = payment.payroll_id
left join public.profiles profile on profile.id = payment.worker_id
where not exists (
  select 1
  from public.financial_expenses expense
  where expense.payroll_payment_id = payment.id
);
