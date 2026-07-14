-- Partner-centered operations architecture.

do $$
begin
  create type public.partner_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.partner_assignment_status as enum ('active', 'ended');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.partner_invoice_status as enum (
    'draft',
    'ready',
    'sent',
    'paid',
    'overdue',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.partner_settlement_status as enum (
    'pending',
    'partial',
    'transferred',
    'waived',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status public.partner_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

alter table public.clients enable row level security;

drop policy if exists "Admins can manage clients" on public.clients;
create policy "Admins can manage clients"
on public.clients
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.clients (name, status, notes)
values ('RM Support', 'active', 'Initial client for partner production work.')
on conflict (name) do nothing;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  full_name text not null,
  email text,
  phone text,
  status public.partner_status not null default 'active',
  start_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partners_client_status_idx
on public.partners(client_id, status);

drop trigger if exists partners_set_updated_at on public.partners;
create trigger partners_set_updated_at
before update on public.partners
for each row
execute function public.set_updated_at();

alter table public.partners enable row level security;

drop policy if exists "Admins can manage partners" on public.partners;
create policy "Admins can manage partners"
on public.partners
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.partner_worker_assignments (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  status public.partner_assignment_status not null default 'active',
  assigned_at date not null default current_date,
  ended_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_worker_assignments_date_order
    check (ended_at is null or ended_at >= assigned_at)
);

create unique index if not exists partner_one_active_worker_idx
on public.partner_worker_assignments(partner_id)
where status = 'active';

create index if not exists partner_worker_assignments_worker_idx
on public.partner_worker_assignments(worker_id, status);

drop trigger if exists partner_worker_assignments_set_updated_at
on public.partner_worker_assignments;
create trigger partner_worker_assignments_set_updated_at
before update on public.partner_worker_assignments
for each row
execute function public.set_updated_at();

alter table public.partner_worker_assignments enable row level security;

drop policy if exists "Admins can manage partner worker assignments"
on public.partner_worker_assignments;
create policy "Admins can manage partner worker assignments"
on public.partner_worker_assignments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.partner_invoices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  invoice_number text not null unique,
  billing_period_start date not null,
  billing_period_end date not null,
  units integer not null default 0 check (units >= 0),
  rate_per_unit numeric(10, 2) not null default 0 check (rate_per_unit >= 0),
  invoice_total numeric(10, 2) not null default 0 check (invoice_total >= 0),
  created_date date not null default current_date,
  sent_date date,
  due_date date,
  status public.partner_invoice_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_invoices_period_order
    check (billing_period_end >= billing_period_start)
);

create index if not exists partner_invoices_partner_status_idx
on public.partner_invoices(partner_id, status, due_date);

drop trigger if exists partner_invoices_set_updated_at on public.partner_invoices;
create trigger partner_invoices_set_updated_at
before update on public.partner_invoices
for each row
execute function public.set_updated_at();

alter table public.partner_invoices enable row level security;

drop policy if exists "Admins can manage partner invoices"
on public.partner_invoices;
create policy "Admins can manage partner invoices"
on public.partner_invoices
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.partner_invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.partner_invoices(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  amount_received numeric(10, 2) not null check (amount_received > 0),
  date_received date not null default current_date,
  payment_method text,
  deposit_account text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists partner_invoice_payments_invoice_idx
on public.partner_invoice_payments(invoice_id, date_received desc);

alter table public.partner_invoice_payments enable row level security;

drop policy if exists "Admins can manage partner invoice payments"
on public.partner_invoice_payments;
create policy "Admins can manage partner invoice payments"
on public.partner_invoice_payments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.partner_settlements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  invoice_id uuid references public.partner_invoices(id) on delete set null,
  amount_received_by_partner numeric(10, 2) not null default 0 check (amount_received_by_partner >= 0),
  amount_partner_keeps numeric(10, 2) not null default 0 check (amount_partner_keeps >= 0),
  amount_transferred_to_scn numeric(10, 2) not null default 0 check (amount_transferred_to_scn >= 0),
  transfer_status public.partner_settlement_status not null default 'pending',
  transfer_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_settlements_partner_status_idx
on public.partner_settlements(partner_id, transfer_status, transfer_date);

drop trigger if exists partner_settlements_set_updated_at
on public.partner_settlements;
create trigger partner_settlements_set_updated_at
before update on public.partner_settlements
for each row
execute function public.set_updated_at();

alter table public.partner_settlements enable row level security;

drop policy if exists "Admins can manage partner settlements"
on public.partner_settlements;
create policy "Admins can manage partner settlements"
on public.partner_settlements
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.partner_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  document_type text,
  file_name text not null,
  storage_path text not null,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_documents_partner_created_idx
on public.partner_documents(partner_id, created_at desc);

drop trigger if exists partner_documents_set_updated_at
on public.partner_documents;
create trigger partner_documents_set_updated_at
before update on public.partner_documents
for each row
execute function public.set_updated_at();

alter table public.partner_documents enable row level security;

drop policy if exists "Admins can manage partner documents"
on public.partner_documents;
create policy "Admins can manage partner documents"
on public.partner_documents
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('partner-documents', 'partner-documents', false)
on conflict (id) do nothing;

drop policy if exists "Admins can manage partner documents in storage"
on storage.objects;
create policy "Admins can manage partner documents in storage"
on storage.objects
for all
to authenticated
using (bucket_id = 'partner-documents' and public.is_admin())
with check (bucket_id = 'partner-documents' and public.is_admin());
