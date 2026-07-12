-- Partner pay rules: none, flat, or invoice percentage.

alter table public.partner_pay_settings
add column if not exists pay_type text not null default 'flat'
  check (pay_type in ('none', 'flat', 'percentage')),
add column if not exists invoice_percentage numeric(5, 2) not null default 0
  check (invoice_percentage >= 0 and invoice_percentage <= 100);

alter table public.partner_payrolls
add column if not exists pay_type_snapshot text not null default 'flat'
  check (pay_type_snapshot in ('none', 'flat', 'percentage')),
add column if not exists invoice_percentage_snapshot numeric(5, 2) not null default 0
  check (invoice_percentage_snapshot >= 0 and invoice_percentage_snapshot <= 100);
