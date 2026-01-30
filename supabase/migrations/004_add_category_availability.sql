alter table categories
  add column if not exists available boolean default true;
