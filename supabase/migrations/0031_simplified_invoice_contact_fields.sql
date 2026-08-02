-- Contact and payment fields for cleaner Partner invoices.

alter table public.clients
add column if not exists email text,
add column if not exists phone text,
add column if not exists address_line1 text,
add column if not exists address_line2 text,
add column if not exists city text,
add column if not exists state text,
add column if not exists country text,
add column if not exists zip_code text;

alter table public.partners
add column if not exists address_line1 text,
add column if not exists address_line2 text,
add column if not exists city text,
add column if not exists state text,
add column if not exists country text,
add column if not exists zip_code text,
add column if not exists bank_account_number text,
add column if not exists bank_routing_number text,
add column if not exists invoice_notes text;
