create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_events_actor_id_idx
  on public.admin_audit_events(actor_id);

create index if not exists admin_audit_events_entity_idx
  on public.admin_audit_events(entity_type, entity_id);

create index if not exists admin_audit_events_created_at_idx
  on public.admin_audit_events(created_at desc);

alter table public.admin_audit_events enable row level security;

drop policy if exists "Admins can read audit events" on public.admin_audit_events;
create policy "Admins can read audit events"
  on public.admin_audit_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.active = true
    )
  );

drop policy if exists "Admins can insert audit events" on public.admin_audit_events;
create policy "Admins can insert audit events"
  on public.admin_audit_events
  for insert
  to authenticated
  with check (
    actor_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.active = true
    )
  );
