alter table restaurants enable row level security;
alter table tables enable row level security;
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;

-- Restaurants: owner write; public read for QR customer menu
create policy "restaurants_owner_select"
  on restaurants for select
  using (owner_id = auth.uid());

create policy "restaurants_public_select"
  on restaurants for select
  to anon, authenticated
  using (true);

create policy "restaurants_owner_insert"
  on restaurants for insert
  with check (owner_id = auth.uid());

create policy "restaurants_owner_update"
  on restaurants for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "restaurants_owner_delete"
  on restaurants for delete
  using (owner_id = auth.uid());

-- Tables: owner write; public read for QR customer menu
create policy "tables_owner_select"
  on tables for select
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "tables_public_select"
  on tables for select
  to anon, authenticated
  using (true);

create policy "tables_owner_insert"
  on tables for insert
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "tables_owner_update"
  on tables for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "tables_owner_delete"
  on tables for delete
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Categories: public read, owner write
create policy "categories_public_select"
  on categories for select
  to anon, authenticated
  using (true);

create policy "categories_owner_select"
  on categories for select
  to authenticated
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "categories_owner_insert"
  on categories for insert
  to authenticated
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "categories_owner_update"
  on categories for update
  to authenticated
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "categories_owner_delete"
  on categories for delete
  to authenticated
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Menu items: public read, owner write
create policy "menu_items_public_select"
  on menu_items for select
  to anon, authenticated
  using (true);

create policy "menu_items_owner_select"
  on menu_items for select
  to authenticated
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "menu_items_owner_insert"
  on menu_items for insert
  to authenticated
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "menu_items_owner_update"
  on menu_items for update
  to authenticated
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "menu_items_owner_delete"
  on menu_items for delete
  to authenticated
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Orders: public insert + anon read of active; owner read/write
create policy "orders_owner_select"
  on orders for select
  to authenticated
  using (
    exists (
      select 1 from restaurants r
      where r.id = orders.restaurant_id and r.owner_id = auth.uid()
    )
  );

create policy "orders_owner_update"
  on orders for update
  to authenticated
  using (
    exists (
      select 1 from restaurants r
      where r.id = orders.restaurant_id and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from restaurants r
      where r.id = orders.restaurant_id and r.owner_id = auth.uid()
    )
  );

create policy "orders_owner_delete"
  on orders for delete
  to authenticated
  using (
    exists (
      select 1 from restaurants r
      where r.id = orders.restaurant_id and r.owner_id = auth.uid()
    )
  );

create policy "orders_public_insert"
  on orders for insert
  to anon, authenticated
  with check (true);

create policy "orders_anon_select_active"
  on orders for select
  to anon
  using (
    archived_at is null
    and status is distinct from 'finish'
  );
