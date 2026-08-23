-- Sync "stop alert" across admin/mobile devices via acknowledged_at.

alter table order_feedbacks
  add column if not exists acknowledged_at timestamptz;

comment on column order_feedbacks.acknowledged_at is
  'When staff dismissed the incoming alert. Null means still ringing on all devices.';

-- Existing reviews should not start ringing after this migration.
update order_feedbacks
set acknowledged_at = coalesce(acknowledged_at, created_at)
where acknowledged_at is null;

create index if not exists order_feedbacks_restaurant_unacked_idx
  on order_feedbacks (restaurant_id, created_at desc)
  where acknowledged_at is null;

-- Owners may mark alerts as seen (and sync to other devices).
drop policy if exists "order_feedbacks_owner_update" on order_feedbacks;
create policy "order_feedbacks_owner_update"
  on order_feedbacks
  for update
  to authenticated
  using (
    exists (
      select 1
      from restaurants r
      where r.id = order_feedbacks.restaurant_id
        and r.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from restaurants r
      where r.id = order_feedbacks.restaurant_id
        and r.owner_id = auth.uid()
    )
  );
