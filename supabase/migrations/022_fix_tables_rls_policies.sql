alter table tables enable row level security;

drop policy if exists "tables_owner_select" on tables;
drop policy if exists "tables_owner_insert" on tables;
drop policy if exists "tables_owner_update" on tables;
drop policy if exists "tables_owner_delete" on tables;

create policy "tables_owner_select"
  on tables
  for select
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = tables.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "tables_owner_insert"
  on tables
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = tables.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "tables_owner_update"
  on tables
  for update
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = tables.restaurant_id
        and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = tables.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

create policy "tables_owner_delete"
  on tables
  for delete
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = tables.restaurant_id
        and r.owner_id = auth.uid()
    )
  );
