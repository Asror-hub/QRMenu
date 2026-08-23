-- Plan start date + two trial statuses. Pending is removed.

alter table restaurants
  add column if not exists subscription_starts_at timestamptz;

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.restaurants'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%subscription_status%';
  if cname is not null then
    execute format('alter table public.restaurants drop constraint %I', cname);
  end if;
end
$$;

update restaurants
set subscription_status = 'trial_15'
where subscription_status in ('pending', 'trialing');

update restaurants
set subscription_starts_at = coalesce(subscription_starts_at, created_at, now())
where subscription_starts_at is null;

alter table restaurants
  alter column subscription_status set default 'trial_15';

alter table restaurants
  add constraint restaurants_subscription_status_check
  check (subscription_status in ('trial_15', 'trial_30', 'active', 'past_due', 'canceled'));

create or replace function public.protect_restaurant_subscription_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_platform_admin() then
    if (
      new.plan_id is distinct from old.plan_id
      or new.billing_cycle is distinct from old.billing_cycle
      or new.subscription_status is distinct from old.subscription_status
      or new.subscription_starts_at is distinct from old.subscription_starts_at
      or new.subscription_expires_at is distinct from old.subscription_expires_at
      or new.subscription_notes is distinct from old.subscription_notes
      or new.venue_type is distinct from old.venue_type
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
  new.plan_updated_at := old.plan_updated_at;
  return new;
end;
$$;
