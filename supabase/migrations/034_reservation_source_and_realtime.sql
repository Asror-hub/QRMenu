-- Connect website reservations to admin/mobile:
-- - source column (website vs staff)
-- - harden public insert to require a real restaurant
-- - enable realtime so admin/mobile refresh on new bookings

alter table reservations
  add column if not exists source text;

do $mig$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_source_check'
  ) then
    alter table reservations
      add constraint reservations_source_check
      check (
        source is null
        or source in ('website', 'admin', 'mobile', 'staff')
      );
  end if;
end;
$mig$;

comment on column reservations.source is
  'Origin of the booking: website (guest), admin, mobile, or staff. Null treated as staff/legacy.';

-- Guests may insert only for an existing restaurant.
drop policy if exists "reservations_public_insert" on reservations;
create policy "reservations_public_insert"
  on reservations
  for insert
  to anon, authenticated
  with check (
    restaurant_id is not null
    and exists (select 1 from restaurants r where r.id = restaurant_id)
  );

do $pub$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reservations'
  ) then
    alter publication supabase_realtime add table reservations;
  end if;
end;
$pub$;
