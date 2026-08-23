-- Ensure restaurant owners can update order status (Accept / Ready / Finish).
-- Re-assert SELECT+UPDATE+DELETE for authenticated owners.
-- (UPDATE also needs SELECT under Postgres RLS.)

drop policy if exists "orders_owner_select" on orders;
drop policy if exists "orders_owner_update" on orders;
drop policy if exists "orders_owner_delete" on orders;
drop policy if exists "orders_public_insert" on orders;

create policy "orders_owner_select"
  on orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = orders.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "orders_owner_update"
  on orders
  for update
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = orders.restaurant_id
        and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = orders.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "orders_owner_delete"
  on orders
  for delete
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = orders.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

-- Guests (and anyone) may place orders / call waiter.
create policy "orders_public_insert"
  on orders
  for insert
  to anon, authenticated
  with check (true);

-- Keep guest read of open orders for the customer status view.
drop policy if exists "orders_anon_select_recent" on orders;
drop policy if exists "orders_anon_select_active" on orders;
create policy "orders_anon_select_active"
  on orders
  for select
  to anon
  using (status is distinct from 'finish');
