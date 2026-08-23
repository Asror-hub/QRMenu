-- Restaurant owners cannot self-register venues. Only the platform superadmin can.

drop policy if exists "restaurants_owner_insert" on restaurants;
create policy "restaurants_owner_insert"
  on restaurants
  for insert
  to authenticated
  with check (public.is_platform_admin());
