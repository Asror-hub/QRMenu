alter table orders
  add column if not exists order_number integer not null default (floor(random() * 900) + 100);
