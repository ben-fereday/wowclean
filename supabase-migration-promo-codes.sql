-- Promo codes migration
-- Adds promo_codes + promo_redemptions tables, snapshot columns on
-- bookings/subscriptions, RLS, and seed data for the launch codes.
-- Run in your Supabase SQL Editor.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. promo_codes table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.promo_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null,
  discount_pct integer not null check (discount_pct > 0 and discount_pct <= 100),
  scope text not null check (scope in ('booking', 'subscription')),
  -- null = unlimited, 1 = one-time use per account
  max_uses_per_user integer check (max_uses_per_user is null or max_uses_per_user > 0),
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (code, scope)
);

alter table public.promo_codes enable row level security;

-- Public read of active codes (used for client-side validation lookups)
create policy "Anyone can read active promo codes"
  on public.promo_codes for select
  using (active = true);

-- Admins/owners see and manage everything
create policy "Admins manage promo codes"
  on public.promo_codes for all
  using (public.is_admin_or_owner());

-- ─────────────────────────────────────────────────────────────
-- 2. promo_redemptions table
-- ─────────────────────────────────────────────────────────────
create table if not exists public.promo_redemptions (
  id uuid default gen_random_uuid() primary key,
  promo_code_id uuid references public.promo_codes(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  booking_id uuid references public.bookings(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  redeemed_at timestamptz default now()
);

create index if not exists promo_redemptions_user_idx
  on public.promo_redemptions (user_id);
create index if not exists promo_redemptions_code_idx
  on public.promo_redemptions (promo_code_id);

alter table public.promo_redemptions enable row level security;

create policy "Users see own redemptions"
  on public.promo_redemptions for select
  using (auth.uid() = user_id);

create policy "Users insert own redemptions"
  on public.promo_redemptions for insert
  with check (auth.uid() = user_id);

create policy "Admins see all redemptions"
  on public.promo_redemptions for select
  using (public.is_admin_or_owner());

create policy "Admins delete redemptions"
  on public.promo_redemptions for delete
  using (public.is_admin_or_owner());

-- ─────────────────────────────────────────────────────────────
-- 3. Snapshot columns on bookings and subscriptions
-- ─────────────────────────────────────────────────────────────
alter table public.bookings
  add column if not exists promo_code text,
  add column if not exists promo_discount_pct integer
    check (promo_discount_pct is null or (promo_discount_pct > 0 and promo_discount_pct <= 100));

alter table public.subscriptions
  add column if not exists promo_code text,
  add column if not exists promo_discount_pct integer
    check (promo_discount_pct is null or (promo_discount_pct > 0 and promo_discount_pct <= 100)),
  add column if not exists promo_code_id uuid references public.promo_codes(id) on delete set null;

-- ─────────────────────────────────────────────────────────────
-- 4. Seed launch codes
-- ─────────────────────────────────────────────────────────────
insert into public.promo_codes (code, discount_pct, scope, max_uses_per_user, active) values
  -- One-time bookings
  ('SPECIAL',     50, 'booking',      1,    true),
  ('FRIEND20',    20, 'booking',      null, true),
  ('PANO',        15, 'booking',      null, true),
  ('FIRST',       15, 'booking',      1,    true),
  ('WOWCLEAN',    10, 'booking',      1,    true),
  ('SPRINGCLEAN', 10, 'booking',      1,    true),
  ('WINTERRESET', 10, 'booking',      1,    true),
  ('SUMMER',      10, 'booking',      1,    true),
  -- Subscriptions
  ('PANO',         15, 'subscription', null, true),
  ('MEMBERSHIP10', 10, 'subscription', null, true),
  ('VIP15',        15, 'subscription', null, true)
on conflict (code, scope) do nothing;

commit;
