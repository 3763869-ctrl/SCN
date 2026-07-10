-- Worker dashboard v1: lunch breaks, payroll display settings, and bonus tiers.

create type public.payroll_schedule as enum ('weekly', 'semi_monthly');

create table public.worker_pay_settings (
  worker_id uuid primary key references public.profiles(id) on delete cascade,
  hourly_rate numeric(10, 2) not null default 0,
  payroll_schedule public.payroll_schedule not null default 'weekly',
  weekly_unit_goal integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger worker_pay_settings_set_updated_at
before update on public.worker_pay_settings
for each row
execute function public.set_updated_at();

alter table public.worker_pay_settings enable row level security;

create policy "Workers can read own pay settings and admins can read all"
on public.worker_pay_settings
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Admins can manage pay settings"
on public.worker_pay_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table public.bonus_tiers (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.profiles(id) on delete cascade,
  threshold_units integer not null check (threshold_units > 0),
  bonus_amount numeric(10, 2) not null check (bonus_amount >= 0),
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bonus_tiers_worker_threshold_idx
on public.bonus_tiers(worker_id, threshold_units);

create trigger bonus_tiers_set_updated_at
before update on public.bonus_tiers
for each row
execute function public.set_updated_at();

alter table public.bonus_tiers enable row level security;

create policy "Workers can read own and global bonus tiers"
on public.bonus_tiers
for select
to authenticated
using (worker_id is null or worker_id = auth.uid() or public.is_admin());

create policy "Admins can manage bonus tiers"
on public.bonus_tiers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create table public.time_breaks (
  id uuid primary key default gen_random_uuid(),
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  break_start_at timestamptz not null default now(),
  break_end_at timestamptz,
  break_type text not null default 'lunch',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_breaks_order check (
    break_end_at is null or break_end_at >= break_start_at
  )
);

create unique index time_breaks_one_open_per_worker_idx
on public.time_breaks(worker_id)
where break_end_at is null;

create index time_breaks_time_entry_idx
on public.time_breaks(time_entry_id);

create trigger time_breaks_set_updated_at
before update on public.time_breaks
for each row
execute function public.set_updated_at();

alter table public.time_breaks enable row level security;

create policy "Workers can read own breaks and admins can read all"
on public.time_breaks
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Workers can create own breaks and admins can create all"
on public.time_breaks
for insert
to authenticated
with check (worker_id = auth.uid() or public.is_admin());

create policy "Workers can update own breaks and admins can update all"
on public.time_breaks
for update
to authenticated
using (worker_id = auth.uid() or public.is_admin())
with check (worker_id = auth.uid() or public.is_admin());

create policy "Admins can delete breaks"
on public.time_breaks
for delete
to authenticated
using (public.is_admin());

insert into public.bonus_tiers (worker_id, threshold_units, bonus_amount, label)
values
  (null, 100, 25, 'Daily push'),
  (null, 200, 60, 'Big day'),
  (null, 300, 100, 'Top performer')
on conflict do nothing;
