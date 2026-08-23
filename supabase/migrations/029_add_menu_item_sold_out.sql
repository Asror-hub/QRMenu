alter table menu_items
  add column if not exists sold_out boolean default false;
