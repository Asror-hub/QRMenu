alter table restaurants enable row level security;
alter table tables enable row level security;
alter table categories enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;

-- Restaurants: owner only
create policy "restaurants_owner_select"
  on restaurants for select
  using (owner_id = auth.uid());

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

-- Tables: owner only
create policy "tables_owner_select"
  on tables for select
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

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
  using (true);

create policy "categories_owner_insert"
  on categories for insert
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "categories_owner_update"
  on categories for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "categories_owner_delete"
  on categories for delete
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Menu items: public read, owner write
create policy "menu_items_public_select"
  on menu_items for select
  using (true);

create policy "menu_items_owner_insert"
  on menu_items for insert
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "menu_items_owner_update"
  on menu_items for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "menu_items_owner_delete"
  on menu_items for delete
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

-- Orders: public insert only, owner read/write
create policy "orders_owner_select"
  on orders for select
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "orders_owner_update"
  on orders for update
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()))
  with check (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "orders_owner_delete"
  on orders for delete
  using (restaurant_id in (select id from restaurants where owner_id = auth.uid()));

create policy "orders_public_insert"
  on orders for insert
  with check (true);
