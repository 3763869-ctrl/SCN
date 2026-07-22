drop policy if exists "Workers can read own voicemails and admins can manage all" on public.phone_voicemails;
create policy "Workers can read own or assigned voicemails and admins can manage all"
on public.phone_voicemails
for select
using (
  worker_id = auth.uid()
  or assigned_worker_id = auth.uid()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and active = true)
);
