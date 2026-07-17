alter table public.profiles
add column if not exists list_order integer;

alter table public.partners
add column if not exists list_order integer;

create index if not exists profiles_list_order_idx on public.profiles(list_order);
create index if not exists partners_list_order_idx on public.partners(list_order);
