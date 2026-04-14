-- WowClean Database Schema
-- Run this in your Supabase SQL Editor

-- Helper: check if the current user is admin or owner
-- Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion
create or replace function public.is_admin_or_owner()
returns boolean
language plpgsql
security definer
stable
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'owner')
  );
end;
$$;

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  first_name text,
  last_name text,
  phone text,
  address text,
  vehicle_make text,
  vehicle_model text,
  vehicle_colour text,
  role text default 'customer' check (role in ('customer', 'admin', 'owner')),
  referral_code text unique,
  referral_credits integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Profiles policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins and owners can view all profiles"
  on public.profiles for select
  using (public.is_admin_or_owner());

create policy "Owner can update any profile"
  on public.profiles for update
  using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- Auto-create profile on signup (copies metadata from auth.users)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, first_name, last_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: find user by email (owner-only)
create or replace function public.find_user_by_email(search_email text)
returns table(id uuid, email text) as $$
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'owner'
  ) then
    raise exception 'Unauthorized';
  end if;

  return query
  select au.id, au.email::text
  from auth.users au
  where au.email = search_email;
end;
$$ language plpgsql security definer;

-- Bookings
create table public.bookings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  -- Guest contact info (used when no account)
  guest_first_name text,
  guest_last_name text,
  guest_email text,
  guest_phone text,
  guest_address text,
  -- Booking details
  vehicle_size text not null check (vehicle_size in ('small', 'medium', 'large')),
  vehicle_make text,
  vehicle_model text,
  vehicle_colour text,
  service_type text not null check (service_type in ('interior', 'exterior', 'full')),
  package text not null check (package in ('standard', 'premium', 'exclusive')),
  addons jsonb default '[]'::jsonb,
  total_estimate integer not null,
  promo_code text,
  promo_discount_pct integer check (promo_discount_pct is null or (promo_discount_pct > 0 and promo_discount_pct <= 100)),
  -- Schedule
  booking_date date not null,
  booking_time text not null,
  location text not null check (location in ('mobile', 'shop')),
  service_address text,
  notes text,
  -- Status
  status text default 'confirmed' check (status in ('confirmed', 'completed', 'cancelled', 'no_show')),
  reference_code text not null,
  created_at timestamptz default now()
);

alter table public.bookings enable row level security;

-- Booking policies
create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = user_id);

create policy "Anyone can create bookings"
  on public.bookings for insert
  with check (true);

create policy "Users can update own bookings"
  on public.bookings for update
  using (auth.uid() = user_id);

create policy "Admins and owners can view all bookings"
  on public.bookings for select
  using (public.is_admin_or_owner());

create policy "Admins and owners can update any booking"
  on public.bookings for update
  using (public.is_admin_or_owner());

-- Subscriptions
create table public.subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  plan text not null check (plan in ('weekly', 'biweekly', 'monthly')),
  package text not null check (package in ('standard', 'premium', 'exclusive')),
  service_type text not null check (service_type in ('interior', 'exterior', 'full')),
  vehicle_size text not null check (vehicle_size in ('small', 'medium', 'large')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'three_month')),
  recurring_day text,
  recurring_time text not null,
  location text not null check (location in ('mobile', 'shop')),
  service_address text,
  vehicle_make text,
  vehicle_model text,
  vehicle_colour text,
  notes text,
  status text default 'active' check (status in ('active', 'paused', 'cancelled')),
  start_date date,
  next_service_date date,
  promo_code text,
  promo_discount_pct integer check (promo_discount_pct is null or (promo_discount_pct > 0 and promo_discount_pct <= 100)),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can update own subscriptions"
  on public.subscriptions for update
  using (auth.uid() = user_id);

create policy "Users can create own subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Admins and owners can view all subscriptions"
  on public.subscriptions for select
  using (public.is_admin_or_owner());

create policy "Admins and owners can update any subscription"
  on public.subscriptions for update
  using (public.is_admin_or_owner());

-- Gallery Images
create table public.gallery_images (
  id uuid default gen_random_uuid() primary key,
  url text not null,
  caption text,
  created_at timestamptz default now()
);

alter table public.gallery_images enable row level security;

create policy "Anyone can view gallery images"
  on public.gallery_images for select
  using (true);

create policy "Admins and owners can manage gallery images"
  on public.gallery_images for all
  using (public.is_admin_or_owner());

-- Create storage bucket for gallery
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true);

create policy "Anyone can view gallery files"
  on storage.objects for select
  using (bucket_id = 'gallery');

create policy "Admins and owners can upload gallery files"
  on storage.objects for insert
  with check (
    bucket_id = 'gallery' and
    public.is_admin_or_owner()
  );

create policy "Admins and owners can delete gallery files"
  on storage.objects for delete
  using (
    bucket_id = 'gallery' and
    public.is_admin_or_owner()
  );

-- Promo Codes
create table public.promo_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null,
  discount_pct integer not null check (discount_pct > 0 and discount_pct <= 100),
  scope text not null check (scope in ('booking', 'subscription')),
  max_uses_per_user integer check (max_uses_per_user is null or max_uses_per_user > 0),
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (code, scope)
);

alter table public.promo_codes enable row level security;

create policy "Anyone can read active promo codes"
  on public.promo_codes for select
  using (active = true);

create policy "Admins manage promo codes"
  on public.promo_codes for all
  using (public.is_admin_or_owner());

-- Backfill the FK column on subscriptions now that promo_codes exists
alter table public.subscriptions
  add column promo_code_id uuid references public.promo_codes(id) on delete set null;

-- Promo Redemptions
create table public.promo_redemptions (
  id uuid default gen_random_uuid() primary key,
  promo_code_id uuid references public.promo_codes(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  booking_id uuid references public.bookings(id) on delete set null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  redeemed_at timestamptz default now()
);

create index promo_redemptions_user_idx on public.promo_redemptions (user_id);
create index promo_redemptions_code_idx on public.promo_redemptions (promo_code_id);

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
