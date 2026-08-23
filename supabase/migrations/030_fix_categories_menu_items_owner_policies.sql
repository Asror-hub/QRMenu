-- Restaurant owners (authenticated) must be able to manage menu categories and items.
-- Without DELETE policies, Supabase returns success with 0 rows deleted.

alter table categories enable row level security;
alter table menu_items enable row level security;

-- Categories: owner write
drop policy if exists "categories_owner_select" on categories;
drop policy if exists "categories_owner_insert" on categories;
drop policy if exists "categories_owner_update" on categories;
drop policy if exists "categories_owner_delete" on categories;

create policy "categories_owner_select"
  on categories
  for select
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = categories.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "categories_owner_insert"
  on categories
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = categories.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "categories_owner_update"
  on categories
  for update
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = categories.restaurant_id
        and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = categories.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "categories_owner_delete"
  on categories
  for delete
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = categories.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

-- Menu items: owner write
drop policy if exists "menu_items_owner_select" on menu_items;
drop policy if exists "menu_items_owner_insert" on menu_items;
drop policy if exists "menu_items_owner_update" on menu_items;
drop policy if exists "menu_items_owner_delete" on menu_items;

create policy "menu_items_owner_select"
  on menu_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = menu_items.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "menu_items_owner_insert"
  on menu_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = menu_items.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "menu_items_owner_update"
  on menu_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = menu_items.restaurant_id
        and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = menu_items.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "menu_items_owner_delete"
  on menu_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = menu_items.restaurant_id
        and r.owner_id = auth.uid()
    )
  );
