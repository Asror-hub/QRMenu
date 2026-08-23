-- POS integration: webhook URL for sending accepted orders to local POS systems
alter table restaurants
  add column if not exists pos_webhook_url text,
  add column if not exists pos_webhook_enabled boolean default false;
