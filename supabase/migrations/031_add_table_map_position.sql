-- Floor-plan positions for tables (percent of map canvas, 0–100)
alter table tables
  add column if not exists map_x numeric,
  add column if not exists map_y numeric;
