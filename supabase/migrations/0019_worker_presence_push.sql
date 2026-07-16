create table if not exists public.worker_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  user_agent text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_push_subscriptions_worker_idx
  on public.worker_push_subscriptions(worker_id, active);

create trigger worker_push_subscriptions_set_updated_at
before update on public.worker_push_subscriptions
for each row
execute function public.set_updated_at();

alter table public.worker_push_subscriptions enable row level security;

drop policy if exists "Workers can manage own push subscriptions" on public.worker_push_subscriptions;
create policy "Workers can manage own push subscriptions"
  on public.worker_push_subscriptions
  for all
  to authenticated
  using (worker_id = auth.uid() or public.is_admin())
  with check (worker_id = auth.uid() or public.is_admin());

create table if not exists public.worker_presence_checks (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  time_entry_id uuid not null references public.time_entries(id) on delete cascade,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'answered', 'missed', 'auto_clocked_out', 'cancelled', 'failed')),
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  expires_at timestamptz not null,
  responded_at timestamptz,
  auto_clock_out_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_presence_checks_worker_idx
  on public.worker_presence_checks(worker_id, created_at desc);

create index if not exists worker_presence_checks_time_entry_idx
  on public.worker_presence_checks(time_entry_id, created_at desc);

create index if not exists worker_presence_checks_status_expiry_idx
  on public.worker_presence_checks(status, expires_at);

create trigger worker_presence_checks_set_updated_at
before update on public.worker_presence_checks
for each row
execute function public.set_updated_at();

alter table public.worker_presence_checks enable row level security;

drop policy if exists "Workers can read own presence checks" on public.worker_presence_checks;
create policy "Workers can read own presence checks"
  on public.worker_presence_checks
  for select
  to authenticated
  using (worker_id = auth.uid() or public.is_admin());

drop policy if exists "Workers can answer own presence checks" on public.worker_presence_checks;
create policy "Workers can answer own presence checks"
  on public.worker_presence_checks
  for update
  to authenticated
  using (worker_id = auth.uid() or public.is_admin())
  with check (worker_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can insert presence checks" on public.worker_presence_checks;
create policy "Admins can insert presence checks"
  on public.worker_presence_checks
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can delete presence checks" on public.worker_presence_checks;
create policy "Admins can delete presence checks"
  on public.worker_presence_checks
  for delete
  to authenticated
  using (public.is_admin());
