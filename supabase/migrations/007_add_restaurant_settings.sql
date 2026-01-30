alter table restaurants
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists logo_url text,
  add column if not exists logo_public_id text,
  add column if not exists currency text default 'USD',
  add column if not exists auto_accept boolean default false,
  add column if not exists sound_alerts boolean default true,
  add column if not exists prep_time integer,
  add column if not exists email_alerts boolean default true,
  add column if not exists status_updates boolean default false;
