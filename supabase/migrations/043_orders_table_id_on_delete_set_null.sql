-- Allow deleting a table after guests have ordered from its QR code.
-- Keep the order history; drop the table link.
alter table orders drop constraint if exists orders_table_id_fkey;

alter table orders
  add constraint orders_table_id_fkey
  foreign key (table_id) references tables (id) on delete set null;
