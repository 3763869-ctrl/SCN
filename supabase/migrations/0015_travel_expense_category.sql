-- Add Travel as a supported expense category.

alter table public.financial_expenses
drop constraint if exists financial_expenses_category_check;

alter table public.financial_expenses
add constraint financial_expenses_category_check
check (category in (
  'payroll',
  'office_expenses',
  'software',
  'banking_payment_fees',
  'professional_services',
  'taxes_government',
  'travel'
));
