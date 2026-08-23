-- Allow QR guests to read open orders for a table (View My Orders / status screen).
-- Replaces the 24-hour window so long-running active orders stay visible.
drop policy if exists "orders_anon_select_recent" on orders;
drop policy if exists "orders_anon_select_active" on orders;
create policy "orders_anon_select_active"
  on orders
  for select
  to anon
  using (status is distinct from 'finish');
