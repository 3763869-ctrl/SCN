-- Zelle payment instructions for Partner invoices.

alter table public.partners
add column if not exists zelle_payment_info text;
