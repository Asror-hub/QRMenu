-- Website / online ordering support (additive only; dine-in QR flow unchanged).
-- - restaurants.slug for public URLs like /site/bella-pizza
-- - order customer + fulfillment fields (nullable for existing table orders)
-- - public reservation insert for website booking

alter table restaurants
  add column if not exists slug text;

create unique index if not exists idx_restaurants_slug
  on restaurants (slug)
  where slug is not null and length(trim(slug)) > 0;

alter table orders
  add column if not exists order_type text,
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists delivery_address text,
  add column if not exists source text;

do $mig$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_order_type_check'
  ) then
    alter table orders
      add constraint orders_order_type_check
      check (
        order_type is null
        or order_type in ('dine_in', 'delivery', 'pickup')
      );
  end if;
end;
$mig$;

comment on column restaurants.slug is 'Public website path segment; optional. QR table URLs do not use this.';
comment on column orders.order_type is 'dine_in (QR/table), delivery, or pickup. Null treated as dine_in for legacy rows.';
comment on column orders.customer_name is 'Required for website delivery/pickup orders.';
comment on column orders.customer_phone is 'Required for website delivery/pickup orders.';
comment on column orders.delivery_address is 'Required when order_type = delivery.';

-- Allow guests to create reservations from the restaurant website.
drop policy if exists "reservations_public_insert" on reservations;
create policy "reservations_public_insert"
  on reservations
  for insert
  to anon, authenticated
  with check (true);
