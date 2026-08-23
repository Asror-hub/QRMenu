-- Customer (QR / anon) access model:
--   READ  restaurants, tables, hours, categories, menu_items, recent orders
--   WRITE orders insert only (place order / call waiter)
-- Admin (authenticated restaurant owner) keeps all modify rights.
-- Guests must never update/delete restaurant, menu, table, or hour rows.

-- Restaurants: public READ (name, hours-related profile fields, etc.)
drop policy if exists "restaurants_public_select" on restaurants;
create policy "restaurants_public_select"
  on restaurants
  for select
  to anon, authenticated
  using (true);

-- Tables: public READ (table number/name for the scanned QR)
drop policy if exists "tables_public_select" on tables;
create policy "tables_public_select"
  on tables
  for select
  to anon, authenticated
  using (true);

-- Hours: public READ; only restaurant owner can modify
alter table restaurant_hours enable row level security;

drop policy if exists "restaurant_hours_public_select" on restaurant_hours;
drop policy if exists "restaurant_hours_owner_insert" on restaurant_hours;
drop policy if exists "restaurant_hours_owner_update" on restaurant_hours;
drop policy if exists "restaurant_hours_owner_delete" on restaurant_hours;

create policy "restaurant_hours_public_select"
  on restaurant_hours
  for select
  to anon, authenticated
  using (true);

create policy "restaurant_hours_owner_insert"
  on restaurant_hours
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = restaurant_hours.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "restaurant_hours_owner_update"
  on restaurant_hours
  for update
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = restaurant_hours.restaurant_id
        and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = restaurant_hours.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "restaurant_hours_owner_delete"
  on restaurant_hours
  for delete
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = restaurant_hours.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

-- Menu: public READ (already intended; re-assert for safety)
drop policy if exists "categories_public_select" on categories;
create policy "categories_public_select"
  on categories
  for select
  to anon, authenticated
  using (true);

drop policy if exists "menu_items_public_select" on menu_items;
create policy "menu_items_public_select"
  on menu_items
  for select
  to anon, authenticated
  using (true);

-- Orders: guests can READ active (non-finished) orders for the status / View My Orders UI,
-- and INSERT new ones. Status changes remain owner-only (no anon update policy).
-- Use active status (not a 24h window) so open table orders stay visible until finished.
do $mig$
begin
  execute 'drop policy if exists "orders_anon_select_recent" on orders';
  execute 'drop policy if exists "orders_anon_select_active" on orders';
  execute 'create policy "orders_anon_select_active" on orders for select to anon using (status is distinct from ''finish'')';
end;
$mig$;
