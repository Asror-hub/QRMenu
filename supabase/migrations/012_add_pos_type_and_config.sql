-- POS type and type-specific config (for future adapters)
alter table restaurants
  add column if not exists pos_type text default 'custom' check (pos_type in ('custom', 'toast', 'dotykacka', 'gastro')),
  add column if not exists pos_config jsonb default '{}';
