alter table restaurants enable row level security;

-- Auto-claim owner_id for legacy rows where it is null.
create or replace function set_restaurant_owner_if_missing()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_restaurant_owner_if_missing on restaurants;
create trigger trg_set_restaurant_owner_if_missing
before insert or update on restaurants
for each row
execute function set_restaurant_owner_if_missing();

drop policy if exists "restaurants_owner_select" on restaurants;
drop policy if exists "restaurants_owner_insert" on restaurants;
drop policy if exists "restaurants_owner_update" on restaurants;
drop policy if exists "restaurants_owner_delete" on restaurants;

create policy "restaurants_owner_select"
  on restaurants
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or owner_id is null
  );

create policy "restaurants_owner_insert"
  on restaurants
  for insert
  to authenticated
  with check (
    coalesce(owner_id, auth.uid()) = auth.uid()
  );

create policy "restaurants_owner_update"
  on restaurants
  for update
  to authenticated
  using (
    owner_id = auth.uid()
    or owner_id is null
  )
  with check (
    coalesce(owner_id, auth.uid()) = auth.uid()
  );

create policy "restaurants_owner_delete"
  on restaurants
  for delete
  to authenticated
  using (
    owner_id = auth.uid()
  );
