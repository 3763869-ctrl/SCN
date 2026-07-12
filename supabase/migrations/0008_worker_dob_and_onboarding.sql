-- Worker date of birth, birthday tracking, and private onboarding links.

create table if not exists public.worker_details (
  worker_id uuid primary key references public.profiles(id) on delete cascade,
  phone_number text,
  date_of_birth date,
  birthday_last_shown_year integer,
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

alter table public.worker_details
drop column if exists age,
add column if not exists date_of_birth date,
add column if not exists birthday_last_shown_year integer;

drop trigger if exists worker_details_set_updated_at on public.worker_details;
create trigger worker_details_set_updated_at
before update on public.worker_details
for each row
execute function public.set_updated_at();

alter table public.worker_details enable row level security;

drop policy if exists "Workers can read own details and admins can read all"
on public.worker_details;
create policy "Workers can read own details and admins can read all"
on public.worker_details
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can manage worker details"
on public.worker_details;
create policy "Admins can manage worker details"
on public.worker_details
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.worker_onboarding_links (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_onboarding_links_worker_created_idx
on public.worker_onboarding_links(worker_id, created_at desc);

drop trigger if exists worker_onboarding_links_set_updated_at
on public.worker_onboarding_links;
create trigger worker_onboarding_links_set_updated_at
before update on public.worker_onboarding_links
for each row
execute function public.set_updated_at();

alter table public.worker_onboarding_links enable row level security;

drop policy if exists "Admins can manage worker onboarding links"
on public.worker_onboarding_links;
create policy "Admins can manage worker onboarding links"
on public.worker_onboarding_links
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
