-- Pricing tables migration
-- Moves pricing from hardcoded constants to database-managed values.
-- Run in your Supabase SQL Editor.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Booking prices (one-time bookings)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.booking_prices (
  id uuid default gen_random_uuid() primary key,
  package text not null check (package in ('standard', 'premium', 'exclusive')),
  vehicle_size text not null check (vehicle_size in ('small', 'medium', 'large')),
  service_type text not null check (service_type in ('interior', 'exterior', 'full')),
  price integer not null check (price >= 0),
  unique (package, vehicle_size, service_type)
);

alter table public.booking_prices enable row level security;

create policy "Anyone can read booking prices"
  on public.booking_prices for select using (true);

create policy "Admins manage booking prices"
  on public.booking_prices for all
  using (public.is_admin_or_owner());

-- Seed booking prices
insert into public.booking_prices (package, vehicle_size, service_type, price) values
  ('standard', 'small',  'interior', 100), ('standard', 'small',  'exterior',  70), ('standard', 'small',  'full', 165),
  ('standard', 'medium', 'interior', 130), ('standard', 'medium', 'exterior',  85), ('standard', 'medium', 'full', 195),
  ('standard', 'large',  'interior', 150), ('standard', 'large',  'exterior', 100), ('standard', 'large',  'full', 225),
  ('premium',  'small',  'interior', 160), ('premium',  'small',  'exterior', 110), ('premium',  'small',  'full', 250),
  ('premium',  'medium', 'interior', 190), ('premium',  'medium', 'exterior', 130), ('premium',  'medium', 'full', 295),
  ('premium',  'large',  'interior', 220), ('premium',  'large',  'exterior', 155), ('premium',  'large',  'full', 335),
  ('exclusive','small',  'interior', 300), ('exclusive','small',  'exterior', 325), ('exclusive','small',  'full', 525),
  ('exclusive','medium', 'interior', 350), ('exclusive','medium', 'exterior', 375), ('exclusive','medium', 'full', 595),
  ('exclusive','large',  'interior', 400), ('exclusive','large',  'exterior', 425), ('exclusive','large',  'full', 675)
on conflict (package, vehicle_size, service_type) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 2. Addon items
-- ─────────────────────────────────────────────────────────────
create table if not exists public.addon_items (
  id text primary key,
  name text not null,
  price integer not null check (price >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.addon_items enable row level security;

create policy "Anyone can read active addons"
  on public.addon_items for select using (true);

create policy "Admins manage addons"
  on public.addon_items for all
  using (public.is_admin_or_owner());

-- Seed addons
insert into public.addon_items (id, name, price, sort_order, active) values
  ('pet_hair',     'Pet Hair Removal',               30, 1, true),
  ('salt',         'Heavy Salt / Sand Cleanup',       30, 2, true),
  ('seat_shamp',   'Seat Shampoo',                    40, 3, true),
  ('carpet_shamp', 'Carpet Shampoo',                  60, 4, true),
  ('leather',      'Leather Conditioning',             40, 5, true),
  ('engine',       'Engine Bay Detail',                40, 6, true),
  ('clay',         'Clay Bar Treatment',               75, 7, true),
  ('iron',         'Iron / Fallout Decontamination',   50, 8, true),
  ('sealant',      'Protective Sealant',               40, 9, true),
  ('polish',       'Stage 1 Polish',                  180, 10, true)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 3. Subscription prices
-- ─────────────────────────────────────────────────────────────
create table if not exists public.subscription_prices (
  id uuid default gen_random_uuid() primary key,
  plan text not null check (plan in ('weekly', 'biweekly', 'monthly')),
  package text not null check (package in ('standard', 'premium')),
  vehicle_size text not null check (vehicle_size in ('small', 'medium', 'large')),
  price integer not null check (price >= 0),
  unique (plan, package, vehicle_size)
);

alter table public.subscription_prices enable row level security;

create policy "Anyone can read subscription prices"
  on public.subscription_prices for select using (true);

create policy "Admins manage subscription prices"
  on public.subscription_prices for all
  using (public.is_admin_or_owner());

-- Seed subscription prices
insert into public.subscription_prices (plan, package, vehicle_size, price) values
  ('weekly',   'standard', 'small', 130), ('weekly',   'standard', 'medium', 155), ('weekly',   'standard', 'large', 180),
  ('biweekly', 'standard', 'small', 145), ('biweekly', 'standard', 'medium', 170), ('biweekly', 'standard', 'large', 195),
  ('monthly',  'standard', 'small', 155), ('monthly',  'standard', 'medium', 185), ('monthly',  'standard', 'large', 215),
  ('monthly',  'premium',  'small', 200), ('monthly',  'premium',  'medium', 245), ('monthly',  'premium',  'large', 295)
on conflict (plan, package, vehicle_size) do nothing;

commit;
