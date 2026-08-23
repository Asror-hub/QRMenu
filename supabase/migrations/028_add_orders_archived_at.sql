-- Soft-archive orders so analytics history is preserved after they leave the live list.
alter table orders
  add column if not exists archived_at timestamptz;

create index if not exists idx_orders_restaurant_archived_at
  on orders (restaurant_id, archived_at);

-- Keep QR guest visibility limited to non-archived active orders.
drop policy if exists "orders_anon_select_active" on orders;
create policy "orders_anon_select_active"
  on orders
  for select
  to anon
  using (
    archived_at is null
    and status is distinct from 'finish'
  );
