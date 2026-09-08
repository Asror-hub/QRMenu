-- Platform can deactivate/activate restaurants and delete them (with related rows).

alter table public.restaurants
  add column if not exists is_active boolean not null default true;

comment on column public.restaurants.is_active is
  'Platform kill switch. False hides the public QR/website menu and blocks owner apps.';

create index if not exists idx_restaurants_is_active
  on public.restaurants (is_active);

-- Owners cannot toggle is_active; only the platform admin can.
create or replace function public.protect_restaurant_subscription_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (Edge Functions) has no platform-admin JWT; auth.uid() is null.
  if public.is_platform_admin() or auth.role() = 'service_role' then
    if (
      new.plan_id is distinct from old.plan_id
      or new.billing_cycle is distinct from old.billing_cycle
      or new.subscription_status is distinct from old.subscription_status
      or new.subscription_starts_at is distinct from old.subscription_starts_at
      or new.subscription_expires_at is distinct from old.subscription_expires_at
      or new.subscription_notes is distinct from old.subscription_notes
      or new.venue_type is distinct from old.venue_type
      or new.is_active is distinct from old.is_active
    ) then
      new.plan_updated_at := now();
    end if;
    return new;
  end if;

  new.plan_id := old.plan_id;
  new.billing_cycle := old.billing_cycle;
  new.subscription_status := old.subscription_status;
  new.subscription_starts_at := old.subscription_starts_at;
  new.subscription_expires_at := old.subscription_expires_at;
  new.subscription_notes := old.subscription_notes;
  new.venue_type := old.venue_type;
  new.is_active := old.is_active;
  new.plan_updated_at := old.plan_updated_at;
  return new;
end;
$$;

-- Self-serve signups cannot insert as deactivated.
create or replace function public.apply_self_serve_restaurant_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    return new;
  end if;

  new.owner_id := auth.uid();
  new.plan_id := 'ordering';
  new.billing_cycle := null;
  new.subscription_status := 'trial_15';
  new.subscription_starts_at := coalesce(new.subscription_starts_at, now());
  new.subscription_expires_at := now() + interval '15 days';
  new.subscription_notes := null;
  new.is_active := true;
  new.plan_updated_at := now();
  return new;
end;
$$;

-- Guest menus only see live venues. Owners still read their own row via owner policy.
drop policy if exists "restaurants_public_select" on public.restaurants;
create policy "restaurants_public_select"
  on public.restaurants
  for select
  to anon, authenticated
  using (is_active);

drop policy if exists "restaurants_owner_delete" on public.restaurants;
create policy "restaurants_owner_delete"
  on public.restaurants
  for delete
  to authenticated
  using (
    public.is_platform_admin()
    or owner_id = auth.uid()
  );

-- Deleting a restaurant should take its operational data with it.
do $$
declare
  rec record;
begin
  for rec in
    select
      n.nspname as schema_name,
      rel.relname as table_name,
      c.conname,
      a.attname as column_name
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    join lateral unnest(c.conkey) with ordinality as cols(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = cols.attnum
    where c.contype = 'f'
      and c.confrelid = 'public.restaurants'::regclass
      and n.nspname = 'public'
      and array_length(c.conkey, 1) = 1
  loop
    execute format(
      'alter table %I.%I drop constraint %I',
      rec.schema_name,
      rec.table_name,
      rec.conname
    );
    execute format(
      'alter table %I.%I add constraint %I foreign key (%I) references public.restaurants(id) on delete cascade',
      rec.schema_name,
      rec.table_name,
      rec.conname,
      rec.column_name
    );
  end loop;
end
$$;

-- Avoid FK order issues when categories and menu_items are both cascaded.
do $$
declare
  rec record;
begin
  for rec in
    select c.conname
    from pg_constraint c
    where c.contype = 'f'
      and c.conrelid = 'public.menu_items'::regclass
      and c.confrelid = 'public.categories'::regclass
  loop
    execute format('alter table public.menu_items drop constraint %I', rec.conname);
    execute format(
      'alter table public.menu_items add constraint %I foreign key (category_id) references public.categories(id) on delete cascade',
      rec.conname
    );
  end loop;
end
$$;
