-- Harden 039: exactly one superadmin, table is the only source of truth,
-- and the owner can register restaurants without taking owner_id.

create unique index if not exists platform_admins_singleton
  on public.platform_admins ((true));

create or replace function public.claim_first_platform_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if exists (select 1 from public.platform_admins where user_id = auth.uid()) then
    return true;
  end if;

  if exists (select 1 from public.platform_admins) then
    return false;
  end if;

  insert into public.platform_admins (user_id) values (auth.uid());

  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) || '{"is_platform_admin": true}'::jsonb
  where id = auth.uid();

  return true;
end;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where user_id = auth.uid()
  );
$$;

create or replace function public.platform_admin_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins);
$$;

revoke all on function public.platform_admin_exists() from public;
grant execute on function public.platform_admin_exists() to anon;
grant execute on function public.platform_admin_exists() to authenticated;

create or replace function public.set_restaurant_owner_if_missing()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is null and not public.is_platform_admin() then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$;

drop policy if exists "restaurants_owner_insert" on restaurants;
create policy "restaurants_owner_insert"
  on restaurants
  for insert
  to authenticated
  with check (
    public.is_platform_admin()
    or coalesce(owner_id, auth.uid()) = auth.uid()
  );
