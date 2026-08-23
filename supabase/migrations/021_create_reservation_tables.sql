create table if not exists reservation_tables (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  table_id uuid not null references tables (id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (reservation_id, table_id)
);

create index if not exists idx_reservation_tables_reservation_id on reservation_tables (reservation_id);
create index if not exists idx_reservation_tables_table_id on reservation_tables (table_id);

alter table reservation_tables enable row level security;

do $mig$
begin
  execute 'drop policy if exists "reservation_tables_owner_select" on reservation_tables';
  execute 'drop policy if exists "reservation_tables_owner_insert" on reservation_tables';
  execute 'drop policy if exists "reservation_tables_owner_update" on reservation_tables';
  execute 'drop policy if exists "reservation_tables_owner_delete" on reservation_tables';

  execute 'create policy "reservation_tables_owner_select" on reservation_tables for select using (reservation_id in (select id from reservations where restaurant_id in (select id from restaurants where owner_id = auth.uid())))';
  execute 'create policy "reservation_tables_owner_insert" on reservation_tables for insert with check (reservation_id in (select id from reservations where restaurant_id in (select id from restaurants where owner_id = auth.uid())))';
  execute 'create policy "reservation_tables_owner_update" on reservation_tables for update using (reservation_id in (select id from reservations where restaurant_id in (select id from restaurants where owner_id = auth.uid()))) with check (reservation_id in (select id from reservations where restaurant_id in (select id from restaurants where owner_id = auth.uid())))';
  execute 'create policy "reservation_tables_owner_delete" on reservation_tables for delete using (reservation_id in (select id from reservations where restaurant_id in (select id from restaurants where owner_id = auth.uid())))';
end;
$mig$;
