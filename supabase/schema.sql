create extension if not exists "uuid-ossp";

create table if not exists restaurants (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  owner_id uuid references auth.users (id),
  created_at timestamp with time zone default now(),
  email text,
  phone text,
  address text,
  instagram text,
  facebook text,
  logo_url text,
  logo_public_id text,
  currency text default 'USD',
  auto_accept boolean default false,
  sound_alerts boolean default true,
  prep_time integer,
  email_alerts boolean default true,
  status_updates boolean default false
);

create table if not exists restaurant_hours (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants (id),
  day_of_week integer not null,
  open_time time,
  close_time time,
  closed boolean default false,
  unique (restaurant_id, day_of_week)
);

create table if not exists tables (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants (id),
  table_number integer not null,
  table_name text,
  created_at timestamp with time zone default now()
);

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants (id),
  name text not null,
  order_index integer,
  available boolean default true
);

create table if not exists menu_items (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants (id),
  category_id uuid references categories (id),
  name text not null,
  description text,
  price numeric not null,
  image_url text,
  image_public_id text,
  available boolean default true
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid references restaurants (id),
  table_id uuid references tables (id),
  items jsonb not null,
  comment text,
  order_number integer not null default (floor(random() * 900) + 100),
  status text check (status in ('pending', 'accepted', 'ready', 'finish')) not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_tables_restaurant_id on tables (restaurant_id);
create index if not exists idx_restaurant_hours_restaurant_id on restaurant_hours (restaurant_id);
create index if not exists idx_categories_restaurant_id on categories (restaurant_id);
create index if not exists idx_menu_items_restaurant_id on menu_items (restaurant_id);
create index if not exists idx_menu_items_category_id on menu_items (category_id);
create index if not exists idx_orders_restaurant_id on orders (restaurant_id);
create index if not exists idx_orders_table_id on orders (table_id);
