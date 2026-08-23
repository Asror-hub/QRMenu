alter table reservations
  add column if not exists reservation_end_time timestamp with time zone;

create index if not exists idx_reservations_reservation_end_time on reservations (reservation_end_time);
