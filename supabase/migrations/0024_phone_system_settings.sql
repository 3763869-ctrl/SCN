create table if not exists public.phone_system_settings (
  id boolean primary key default true check (id = true),
  active boolean not null default true,
  availability_mode text not null default 'business_hours'
    check (availability_mode in ('business_hours', 'worker_clock')),
  business_timezone text not null default 'America/New_York',
  business_days integer[] not null default array[0, 1, 2, 3, 4, 5],
  business_start_time time not null default '09:00',
  business_end_time time not null default '17:00',
  working_hours_greeting text not null default 'Thank you for calling RM Support. Please enter the worker extension you are trying to reach.',
  after_hours_greeting text not null default 'Thank you for calling RM Support. We are currently closed. Please leave a message and we will call you back at the first opportunity.',
  voicemail_greeting text not null default 'No one is available right now. Please leave a message after the beep.',
  ring_timeout_seconds integer not null default 60 check (ring_timeout_seconds between 10 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.phone_system_settings (id)
values (true)
on conflict (id) do nothing;

drop trigger if exists phone_system_settings_set_updated_at on public.phone_system_settings;
create trigger phone_system_settings_set_updated_at
before update on public.phone_system_settings
for each row execute function public.set_updated_at();

alter table public.phone_system_settings enable row level security;

drop policy if exists "Admins can manage phone system settings" on public.phone_system_settings;
create policy "Admins can manage phone system settings"
on public.phone_system_settings
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true));

drop policy if exists "Workers can read phone system settings" on public.phone_system_settings;
create policy "Workers can read phone system settings"
on public.phone_system_settings
for select
using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'worker') and active = true)
);
