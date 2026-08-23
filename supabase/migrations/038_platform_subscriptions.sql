-- Platform / super-admin: subscription control + payment log

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    ((auth.jwt() -> 'app_metadata' ->> 'is_platform_admin') = 'true'),
    false
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_platform_admin() to anon;

alter table restaurants
  add column if not exists plan_id text
    check (plan_id is null or plan_id in ('ordering', 'grow', 'ops')),
  add column if not exists billing_cycle text
    check (billing_cycle is null or billing_cycle in ('monthly', 'yearly')),
  add column if not exists subscription_status text
    not null default 'pending'
    check (subscription_status in ('pending', 'trialing', 'active', 'past_due', 'canceled')),
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists subscription_notes text,
  add column if not exists venue_type text,
  add column if not exists plan_updated_at timestamptz;

-- Keep existing restaurants usable until managed in Platform
update restaurants
set
  subscription_status = 'active',
  plan_id = coalesce(plan_id, 'ops'),
  plan_updated_at = coalesce(plan_updated_at, now())
where plan_id is null
   or subscription_status = 'pending';

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
      or new.subscription_expires_at is distinct from old.subscription_expires_at
      or new.subscription_notes is distinct from old.subscription_notes
      or new.venue_type is distinct from old.venue_type
    ) then
      new.plan_updated_at := now();
    end if;
    return new;
  end if;

  -- Restaurant owners cannot self-upgrade plan / subscription fields
  new.plan_id := old.plan_id;
  new.billing_cycle := old.billing_cycle;
  new.subscription_status := old.subscription_status;
  new.subscription_expires_at := old.subscription_expires_at;
  new.subscription_notes := old.subscription_notes;
  new.venue_type := old.venue_type;
  new.plan_updated_at := old.plan_updated_at;
  return new;
end;
$$;

drop trigger if exists trg_protect_restaurant_subscription_fields on restaurants;
create trigger trg_protect_restaurant_subscription_fields
before update on restaurants
for each row
execute function public.protect_restaurant_subscription_fields();

create table if not exists subscription_payments (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  amount numeric not null check (amount >= 0),
  currency text not null default 'UZS',
  method text not null default 'other'
    check (method in ('payme', 'click', 'cash', 'bank_transfer', 'other')),
  paid_at timestamptz not null default now(),
  period_start date,
  period_end date,
  plan_id text check (plan_id is null or plan_id in ('ordering', 'grow', 'ops')),
  billing_cycle text check (billing_cycle is null or billing_cycle in ('monthly', 'yearly')),
  note text,
  recorded_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_subscription_payments_restaurant_id
  on subscription_payments (restaurant_id);

create index if not exists idx_subscription_payments_paid_at
  on subscription_payments (paid_at desc);

create index if not exists idx_restaurants_subscription_status
  on restaurants (subscription_status);

create index if not exists idx_restaurants_plan_id
  on restaurants (plan_id);

alter table subscription_payments enable row level security;

-- Expand restaurant owner policies to include platform admin
drop policy if exists "restaurants_owner_select" on restaurants;
create policy "restaurants_owner_select"
  on restaurants
  for select
  to authenticated
  using (
    public.is_platform_admin()
    or owner_id = auth.uid()
    or owner_id is null
  );

drop policy if exists "restaurants_owner_update" on restaurants;
create policy "restaurants_owner_update"
  on restaurants
  for update
  to authenticated
  using (
    public.is_platform_admin()
    or owner_id = auth.uid()
    or owner_id is null
  )
  with check (
    public.is_platform_admin()
    or coalesce(owner_id, auth.uid()) = auth.uid()
  );

-- Payments: platform admin only
drop policy if exists "Platform admin select subscription_payments" on subscription_payments;
create policy "Platform admin select subscription_payments"
  on subscription_payments for select
  to authenticated
  using (public.is_platform_admin());

drop policy if exists "Platform admin insert subscription_payments" on subscription_payments;
create policy "Platform admin insert subscription_payments"
  on subscription_payments for insert
  to authenticated
  with check (public.is_platform_admin());

drop policy if exists "Platform admin update subscription_payments" on subscription_payments;
create policy "Platform admin update subscription_payments"
  on subscription_payments for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "Platform admin delete subscription_payments" on subscription_payments;
create policy "Platform admin delete subscription_payments"
  on subscription_payments for delete
  to authenticated
  using (public.is_platform_admin());
