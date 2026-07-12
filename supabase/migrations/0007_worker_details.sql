-- Extra worker profile details for admin worker management.

create table public.worker_details (
  worker_id uuid primary key references public.profiles(id) on delete cascade,
  phone_number text,
  age integer check (age is null or (age >= 0 and age <= 120)),
  address_line1 text,
  city text,
  state text,
  country text,
  zip_code text,
  secondary_contact_name text,
  secondary_contact_phone text,
  start_date date,
  hiring_source text,
  referral_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger worker_details_set_updated_at
before update on public.worker_details
for each row
execute function public.set_updated_at();

alter table public.worker_details enable row level security;

create policy "Workers can read own details and admins can read all"
on public.worker_details
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Admins can manage worker details"
on public.worker_details
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
