-- Restore self-serve restaurant registration.
-- Owners may insert their own venue. Subscription fields are forced to a
-- 15-day trial on insert so they cannot grant themselves a paid plan.
-- Platform admins keep full control of plan / status on insert.

drop policy if exists "restaurants_owner_insert" on restaurants;
create policy "restaurants_owner_insert"
  on restaurants
  for insert
  to authenticated
  with check (
    public.is_platform_admin()
    or coalesce(owner_id, auth.uid()) = auth.uid()
  );

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
  new.plan_updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_apply_self_serve_restaurant_defaults on restaurants;
create trigger trg_apply_self_serve_restaurant_defaults
before insert on restaurants
for each row
execute function public.apply_self_serve_restaurant_defaults();
