-- Payment support for orders
alter table orders
  add column if not exists payment_status text check (payment_status in ('pending', 'paid', 'failed', 'refunded')) default null,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists amount_paid numeric;

-- Stripe enablement per restaurant (platform uses single Stripe account)
alter table restaurants
  add column if not exists stripe_enabled boolean default false;
