-- Extra bank payment fields for Partner invoice payment instructions.

alter table public.partners
add column if not exists bank_name text,
add column if not exists bank_account_holder_name text;
