-- Auto-accept new orders when restaurant has auto_accept enabled
create or replace function auto_accept_order_on_insert()
returns trigger as $$
begin
  if new.status = 'pending' and exists (
    select 1 from restaurants r
    where r.id = new.restaurant_id and r.auto_accept = true
  ) then
    new.status := 'accepted';
    new.accepted_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_auto_accept_order on orders;
create trigger trg_auto_accept_order
  before insert on orders
  for each row
  execute function auto_accept_order_on_insert();
