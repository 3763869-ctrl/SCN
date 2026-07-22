alter table public.phone_voicemails
add column if not exists assigned_worker_id uuid references public.profiles(id) on delete set null,
add column if not exists completed_at timestamptz,
add column if not exists completed_by uuid references public.profiles(id) on delete set null;

create index if not exists phone_voicemails_assigned_worker_idx
on public.phone_voicemails(assigned_worker_id, created_at desc);
