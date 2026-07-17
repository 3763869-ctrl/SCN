-- Time tracking integrity guards.
-- These stop one worker's clock session from being reassigned to, or closed
-- through, another worker's record.

create or replace function public.prevent_worker_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.worker_id is distinct from new.worker_id then
    raise exception 'worker_id cannot be changed after creation';
  end if;

  return new;
end;
$$;

drop trigger if exists time_entries_prevent_worker_change on public.time_entries;
create trigger time_entries_prevent_worker_change
before update of worker_id on public.time_entries
for each row
execute function public.prevent_worker_id_change();

drop trigger if exists production_units_prevent_worker_change on public.production_units;
create trigger production_units_prevent_worker_change
before update of worker_id on public.production_units
for each row
execute function public.prevent_worker_id_change();

create or replace function public.ensure_time_break_worker_matches_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  entry_worker_id uuid;
begin
  select worker_id
  into entry_worker_id
  from public.time_entries
  where id = new.time_entry_id;

  if entry_worker_id is null then
    raise exception 'time break must reference an existing time entry';
  end if;

  if new.worker_id is distinct from entry_worker_id then
    raise exception 'time break worker must match the time entry worker';
  end if;

  return new;
end;
$$;

drop trigger if exists time_breaks_worker_matches_entry on public.time_breaks;
create trigger time_breaks_worker_matches_entry
before insert or update of worker_id, time_entry_id on public.time_breaks
for each row
execute function public.ensure_time_break_worker_matches_entry();

create or replace function public.ensure_presence_check_worker_matches_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  entry_worker_id uuid;
begin
  select worker_id
  into entry_worker_id
  from public.time_entries
  where id = new.time_entry_id;

  if entry_worker_id is null then
    raise exception 'presence check must reference an existing time entry';
  end if;

  if new.worker_id is distinct from entry_worker_id then
    raise exception 'presence check worker must match the time entry worker';
  end if;

  return new;
end;
$$;

drop trigger if exists worker_presence_checks_worker_matches_entry
on public.worker_presence_checks;
create trigger worker_presence_checks_worker_matches_entry
before insert or update of worker_id, time_entry_id on public.worker_presence_checks
for each row
execute function public.ensure_presence_check_worker_matches_entry();
