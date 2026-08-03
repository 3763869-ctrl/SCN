-- Allow voided/cancelled invoices to stop blocking regenerated invoice previews.

alter table public.partner_invoices
drop constraint if exists partner_invoices_invoice_number_key;

drop index if exists public.partner_invoice_unique_active_period_idx;

create unique index if not exists partner_invoice_unique_active_period_idx
on public.partner_invoices(partner_id, billing_period_start, billing_period_end)
where status <> 'cancelled'
  and voided_at is null;

create unique index if not exists partner_invoices_unique_active_invoice_number_idx
on public.partner_invoices(invoice_number)
where status <> 'cancelled'
  and voided_at is null;
