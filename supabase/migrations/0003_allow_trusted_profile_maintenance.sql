-- Allow trusted SQL/service contexts to maintain profile role and active fields.
-- App users still need admin role to change protected profile fields.

create or replace function public.prevent_worker_profile_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;

  new.id = old.id;
  new.email = old.email;
  new.role = old.role;
  new.active = old.active;
  new.created_at = old.created_at;

  return new;
end;
$$;
