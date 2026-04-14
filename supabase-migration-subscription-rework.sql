-- Subscription rework migration
-- 1. Rename "supreme" package -> "premium" everywhere
-- 2. Add new subscription fields: vehicle info, notes, billing cycle, start date
-- Run this in your Supabase SQL Editor.

begin;

-- ─────────────────────────────────────────────────────────────
-- 1. Rename supreme -> premium
-- ─────────────────────────────────────────────────────────────

-- Drop existing CHECK constraints (Postgres auto-named them <table>_<col>_check)
alter table public.bookings       drop constraint if exists bookings_package_check;
alter table public.subscriptions  drop constraint if exists subscriptions_package_check;

-- Rename data
update public.bookings      set package = 'premium' where package = 'supreme';
update public.subscriptions set package = 'premium' where package = 'supreme';

-- Re-add CHECK constraints with the new value set
alter table public.bookings
  add constraint bookings_package_check
  check (package in ('standard', 'premium', 'exclusive'));

alter table public.subscriptions
  add constraint subscriptions_package_check
  check (package in ('standard', 'premium', 'exclusive'));

-- ─────────────────────────────────────────────────────────────
-- 2. Add new subscription columns
-- ─────────────────────────────────────────────────────────────

alter table public.subscriptions
  add column if not exists vehicle_make   text,
  add column if not exists vehicle_model  text,
  add column if not exists vehicle_colour text,
  add column if not exists notes          text,
  add column if not exists billing_cycle  text not null default 'monthly'
    check (billing_cycle in ('monthly', 'three_month')),
  add column if not exists start_date     date;

-- Backfill start_date for existing rows from next_service_date
update public.subscriptions
  set start_date = next_service_date
  where start_date is null and next_service_date is not null;

-- recurring_day is now derived from start_date (kept nullable for backward compat / display)
alter table public.subscriptions
  alter column recurring_day drop not null;

commit;
