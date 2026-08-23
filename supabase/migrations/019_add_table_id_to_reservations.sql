alter table reservations
  add column if not exists table_id uuid references tables (id) on delete set null;

create index if not exists idx_reservations_table_id on reservations (table_id);
