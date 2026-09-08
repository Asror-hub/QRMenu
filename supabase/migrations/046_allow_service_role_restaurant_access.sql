-- Allow the manage-restaurant Edge Function (service role) to toggle is_active.
-- Migration 045 blocked that because auth.uid() is null for service-role updates.

create or replace function public.protect_restaurant_subscription_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
