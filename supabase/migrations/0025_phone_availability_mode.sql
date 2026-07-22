alter table public.phone_system_settings
add column if not exists availability_mode text not null default 'business_hours';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'phone_system_settings_availability_mode_check'
      and conrelid = 'public.phone_system_settings'::regclass
  ) then
    alter table public.phone_system_settings
    add constraint phone_system_settings_availability_mode_check
    check (availability_mode in ('business_hours', 'worker_clock'));
  end if;
end $$;
