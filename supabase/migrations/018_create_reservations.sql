-- Reservations table for admin booking flow
create table if not exists reservations (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  customer_name text not null,
  phone_number text not null,
  guest_count integer not null check (guest_count > 0),
  reservation_date timestamp with time zone not null,
  reservation_time timestamp with time zone,
  status text not null default 'booked' check (status in ('booked', 'seated', 'cancelled', 'completed')),
  notes text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_reservations_restaurant_id on reservations (restaurant_id);
create index if not exists idx_reservations_reservation_date on reservations (reservation_date);
create index if not exists idx_reservations_restaurant_date on reservations (restaurant_id, reservation_date);

alter table reservations enable row level security;

do $mig$
begin
  execute 'drop policy if exists "reservations_owner_select" on reservations';
  execute 'drop policy if exists "reservations_owner_insert" on reservations';
  execute 'drop policy if exists "reservations_owner_update" on reservations';
  execute 'drop policy if exists "reservations_owner_delete" on reservations';

  execute 'create policy "reservations_owner_select" on reservations for select using (restaurant_id in (select id from restaurants where owner_id = auth.uid()))';
  execute 'create policy "reservations_owner_insert" on reservations for insert with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()))';
  execute 'create policy "reservations_owner_update" on reservations for update using (restaurant_id in (select id from restaurants where owner_id = auth.uid())) with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()))';
  execute 'create policy "reservations_owner_delete" on reservations for delete using (restaurant_id in (select id from restaurants where owner_id = auth.uid()))';
end;
$mig$;
