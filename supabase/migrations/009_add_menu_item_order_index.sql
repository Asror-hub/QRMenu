-- Add order_index to menu_items for drag-and-drop ordering
alter table menu_items add column if not exists order_index integer;

-- Backfill: assign order_index within each category based on current name order
with ranked as (
  select id, row_number() over (partition by category_id order by name nulls last) as rn
  from menu_items
)
update menu_items m
set order_index = r.rn
from ranked r
where m.id = r.id and m.order_index is null;
