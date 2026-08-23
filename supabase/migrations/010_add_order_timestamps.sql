-- Add timestamp columns for order status transitions
alter table orders
  add column if not exists accepted_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists finished_at timestamptz;
