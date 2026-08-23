-- Add local_print option to pos_type (Plan B: mobile app + Bluetooth printer)
-- Run in Supabase SQL Editor if needed
alter table restaurants drop constraint if exists restaurants_pos_type_check;
alter table restaurants add constraint restaurants_pos_type_check
  check (pos_type in ('custom', 'toast', 'dotykacka', 'gastro', 'local_print'));
