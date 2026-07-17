alter table public.profiles
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
add column if not exists deletion_expires_at timestamptz,
add column if not exists delete_reason text;

create index if not exists profiles_deleted_at_idx on public.profiles(deleted_at);
create index if not exists profiles_deletion_expires_at_idx on public.profiles(deletion_expires_at);
