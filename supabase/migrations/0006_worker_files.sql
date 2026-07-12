-- Worker document/file tracking.

create table public.worker_files (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.profiles(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  document_type text,
  signed boolean not null default false,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index worker_files_worker_created_idx
on public.worker_files(worker_id, created_at desc);

create trigger worker_files_set_updated_at
before update on public.worker_files
for each row
execute function public.set_updated_at();

alter table public.worker_files enable row level security;

create policy "Workers can read own files and admins can read all"
on public.worker_files
for select
to authenticated
using (worker_id = auth.uid() or public.is_admin());

create policy "Admins can manage worker files"
on public.worker_files
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('worker-files', 'worker-files', false)
on conflict (id) do nothing;

create policy "Admins can upload worker files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'worker-files' and public.is_admin());

create policy "Admins can manage worker files in storage"
on storage.objects
for all
to authenticated
using (bucket_id = 'worker-files' and public.is_admin())
with check (bucket_id = 'worker-files' and public.is_admin());

create policy "Workers can read own stored files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'worker-files'
  and (
    public.is_admin()
    or exists (
      select 1
      from public.worker_files
      where worker_files.storage_path = storage.objects.name
        and worker_files.worker_id = auth.uid()
    )
  )
);
