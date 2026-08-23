-- Guest order feedback (food + service ratings) after order is finished.

create table if not exists order_feedbacks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  table_id uuid references tables (id) on delete set null,
  order_number integer,
  food_rating smallint not null check (food_rating between 1 and 5),
  service_rating smallint not null check (service_rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  constraint order_feedbacks_order_id_key unique (order_id)
);

create index if not exists order_feedbacks_restaurant_created_idx
  on order_feedbacks (restaurant_id, created_at desc);

comment on table order_feedbacks is
  'Guest ratings for food and service, collected when an order reaches finish.';

alter table order_feedbacks enable row level security;

-- Guests may submit feedback for a known restaurant.
-- Note: do not EXISTS-check orders here — anon RLS hides finished orders,
-- which is exactly when feedback is collected.
drop policy if exists "order_feedbacks_public_insert" on order_feedbacks;
create policy "order_feedbacks_public_insert"
  on order_feedbacks
  for insert
  to anon, authenticated
  with check (
    restaurant_id is not null
    and order_id is not null
    and food_rating between 1 and 5
    and service_rating between 1 and 5
    and exists (select 1 from restaurants r where r.id = restaurant_id)
  );

-- Restaurant owners can read their feedback history.
drop policy if exists "order_feedbacks_owner_select" on order_feedbacks;
create policy "order_feedbacks_owner_select"
  on order_feedbacks
  for select
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = order_feedbacks.restaurant_id
        and r.owner_id = auth.uid()
    )
  );

-- Optional: owners may delete spam / mistaken entries.
drop policy if exists "order_feedbacks_owner_delete" on order_feedbacks;
create policy "order_feedbacks_owner_delete"
  on order_feedbacks
  for delete
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = order_feedbacks.restaurant_id
        and r.owner_id = auth.uid()
    )
  );
