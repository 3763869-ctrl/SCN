create table if not exists public.worker_phone_settings (
  worker_id uuid primary key references public.profiles(id) on delete cascade,
  extension text unique,
  phone_enabled boolean not null default false,
  calling_enabled boolean not null default false,
  texting_enabled boolean not null default false,
  voicemail_greeting text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists worker_phone_settings_set_updated_at on public.worker_phone_settings;
create trigger worker_phone_settings_set_updated_at
before update on public.worker_phone_settings
for each row execute function public.set_updated_at();

create table if not exists public.phone_contacts (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.profiles(id) on delete cascade,
  display_name text,
  phone_number text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists phone_contacts_set_updated_at on public.phone_contacts;
create trigger phone_contacts_set_updated_at
before update on public.phone_contacts
for each row execute function public.set_updated_at();

create table if not exists public.phone_message_threads (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  contact_number text not null,
  contact_name text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(worker_id, contact_number)
);

drop trigger if exists phone_message_threads_set_updated_at on public.phone_message_threads;
create trigger phone_message_threads_set_updated_at
before update on public.phone_message_threads
for each row execute function public.set_updated_at();

create table if not exists public.phone_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.phone_message_threads(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text not null,
  to_number text not null,
  body text not null,
  status text not null default 'queued',
  twilio_message_sid text unique,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists phone_messages_set_updated_at on public.phone_messages;
create trigger phone_messages_set_updated_at
before update on public.phone_messages
for each row execute function public.set_updated_at();

create table if not exists public.phone_call_logs (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.profiles(id) on delete set null,
  direction text not null check (direction in ('inbound', 'outbound')),
  from_number text,
  to_number text,
  caller_name text,
  status text not null default 'initiated',
  twilio_call_sid text unique,
  duration_seconds integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists phone_call_logs_set_updated_at on public.phone_call_logs;
create trigger phone_call_logs_set_updated_at
before update on public.phone_call_logs
for each row execute function public.set_updated_at();

create table if not exists public.phone_voicemails (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.profiles(id) on delete set null,
  call_log_id uuid references public.phone_call_logs(id) on delete set null,
  from_number text,
  recording_url text,
  recording_sid text unique,
  duration_seconds integer,
  transcription text,
  status text not null default 'received',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists phone_voicemails_set_updated_at on public.phone_voicemails;
create trigger phone_voicemails_set_updated_at
before update on public.phone_voicemails
for each row execute function public.set_updated_at();

create index if not exists worker_phone_settings_extension_idx on public.worker_phone_settings(extension);
create index if not exists phone_contacts_worker_idx on public.phone_contacts(worker_id);
create index if not exists phone_message_threads_worker_idx on public.phone_message_threads(worker_id);
create index if not exists phone_messages_worker_idx on public.phone_messages(worker_id, created_at desc);
create index if not exists phone_call_logs_worker_idx on public.phone_call_logs(worker_id, created_at desc);
create index if not exists phone_voicemails_worker_idx on public.phone_voicemails(worker_id, created_at desc);

alter table public.worker_phone_settings enable row level security;
alter table public.phone_contacts enable row level security;
alter table public.phone_message_threads enable row level security;
alter table public.phone_messages enable row level security;
alter table public.phone_call_logs enable row level security;
alter table public.phone_voicemails enable row level security;

create policy "Workers can read own phone settings and admins can manage all"
on public.worker_phone_settings
for select
using (
  worker_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true)
);

create policy "Admins can manage worker phone settings"
on public.worker_phone_settings
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true));

create policy "Workers can read own phone contacts and admins can manage all"
on public.phone_contacts
for select
using (
  worker_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true)
);

create policy "Workers can manage own phone contacts"
on public.phone_contacts
for all
using (worker_id = auth.uid())
with check (worker_id = auth.uid());

create policy "Admins can manage phone contacts"
on public.phone_contacts
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true));

create policy "Workers can read own message threads and admins can manage all"
on public.phone_message_threads
for select
using (
  worker_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true)
);

create policy "Workers can manage own message threads"
on public.phone_message_threads
for all
using (worker_id = auth.uid())
with check (worker_id = auth.uid());

create policy "Admins can manage message threads"
on public.phone_message_threads
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true));

create policy "Workers can read own messages and admins can manage all"
on public.phone_messages
for select
using (
  worker_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true)
);

create policy "Workers can insert own outbound messages"
on public.phone_messages
for insert
with check (worker_id = auth.uid() and direction = 'outbound');

create policy "Admins can manage messages"
on public.phone_messages
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true));

create policy "Workers can read own call logs and admins can manage all"
on public.phone_call_logs
for select
using (
  worker_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true)
);

create policy "Workers can insert own outbound call logs"
on public.phone_call_logs
for insert
with check (worker_id = auth.uid() and direction = 'outbound');

create policy "Admins can manage call logs"
on public.phone_call_logs
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true));

create policy "Workers can read own voicemails and admins can manage all"
on public.phone_voicemails
for select
using (
  worker_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true)
);

create policy "Admins can manage voicemails"
on public.phone_voicemails
for all
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true));
