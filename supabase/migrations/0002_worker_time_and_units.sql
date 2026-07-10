-- Worker time tracking and production unit foundations.

create type public.production_unit_status as enum ('pending', 'approved', 'rejected');

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_entries_clock_order check (
    clock_out_at is null or clock_out_at >= clock_in_at
  )
);

create unique index time_entries_one_open_per_worker_idx
on public.time_entries(worker_id)
where clock_out_at is null;

create index time_entries_worker_clock_in_idx
on public.time_entries(worker_id, clock_in_at desc);

create trigger time_entries_set_updated_at
before update on public.time_entries
for each row
execute function public.set_updated_at();

alter table public.time_entries enable row level security;

create policy "Workers can read own time entries and admins can read all"
on public.time_entries
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Workers can create own time entries and admins can create all"
on public.time_entries
for insert
to authenticated
with check (worker_id = auth.uid() or public.is_admin());

create policy "Workers can update own time entries and admins can update all"
on public.time_entries
for update
to authenticated
using (worker_id = auth.uid() or public.is_admin())
with check (worker_id = auth.uid() or public.is_admin());

create policy "Admins can delete time entries"
on public.time_entries
for delete
to authenticated
using (public.is_admin());

create table public.production_units (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  work_date date not null default current_date,
  notes text,
  status public.production_unit_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index production_units_worker_work_date_idx
on public.production_units(worker_id, work_date desc);

create index production_units_status_idx
on public.production_units(status);

create trigger production_units_set_updated_at
before update on public.production_units
for each row
execute function public.set_updated_at();

alter table public.production_units enable row level security;

create policy "Workers can read own units and admins can read all"
on public.production_units
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Workers can create own units and admins can create all"
on public.production_units
for insert
to authenticated
with check (worker_id = auth.uid() or public.is_admin());

create policy "Workers can update own pending units and admins can update all"
on public.production_units
for update
to authenticated
using (
  public.is_admin()
  or (worker_id = auth.uid() and status = 'pending')
)
with check (
  public.is_admin()
  or (worker_id = auth.uid() and status = 'pending')
);

create policy "Admins can delete units"
on public.production_units
for delete
to authenticated
using (public.is_admin());
