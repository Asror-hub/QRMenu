create table if not exists restaurant_hours (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants (id),
  day_of_week integer not null,
  open_time time,
  close_time time,
  closed boolean default false,
  unique (restaurant_id, day_of_week)
);

create index if not exists idx_restaurant_hours_restaurant_id on restaurant_hours (restaurant_id);
