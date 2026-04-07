-- Migration: Fix infinite recursion in RLS policies
-- Run this ALL AT ONCE in your Supabase SQL Editor
--
-- ROOT CAUSE: Admin policies on "profiles" do
--   EXISTS (SELECT 1 FROM profiles WHERE role IN ('admin','owner'))
-- which triggers the same policy on profiles again → infinite loop.
--
-- FIX: A SECURITY DEFINER function bypasses RLS when checking the role,
-- breaking the recursion chain.

-- Step 1: Create a safe role-check function (bypasses RLS)
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

-- Step 2: Drop all recursive policies
drop policy if exists "Admins and owners can view all profiles" on public.profiles;
drop policy if exists "Owner can update any profile" on public.profiles;
drop policy if exists "Admins and owners can view all bookings" on public.bookings;
drop policy if exists "Admins and owners can update any booking" on public.bookings;
drop policy if exists "Admins and owners can view all subscriptions" on public.subscriptions;
drop policy if exists "Admins and owners can update any subscription" on public.subscriptions;
drop policy if exists "Admins and owners can manage gallery images" on public.gallery_images;
drop policy if exists "Admins and owners can upload gallery files" on storage.objects;
drop policy if exists "Admins and owners can delete gallery files" on storage.objects;

-- Also drop any leftover old-style policies (from original schema)
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Admins can view all bookings" on public.bookings;
drop policy if exists "Admins can update any booking" on public.bookings;
drop policy if exists "Admins can view all subscriptions" on public.subscriptions;
drop policy if exists "Admins can update any subscription" on public.subscriptions;
drop policy if exists "Admins can manage gallery images" on public.gallery_images;
drop policy if exists "Admins can upload gallery files" on storage.objects;
drop policy if exists "Admins can delete gallery files" on storage.objects;

-- Step 3: Recreate all admin/owner policies using the safe function

-- Profiles
create policy "Admins and owners can view all profiles"
  on public.profiles for select
  using (public.is_admin_or_owner());

create policy "Owner can update any profile"
  on public.profiles for update
  using (
    (select role from public.profiles where id = auth.uid()) = 'owner'
  );

-- Bookings
create policy "Admins and owners can view all bookings"
  on public.bookings for select
  using (public.is_admin_or_owner());

create policy "Admins and owners can update any booking"
  on public.bookings for update
  using (public.is_admin_or_owner());

-- Subscriptions
create policy "Admins and owners can view all subscriptions"
  on public.subscriptions for select
  using (public.is_admin_or_owner());

create policy "Admins and owners can update any subscription"
  on public.subscriptions for update
  using (public.is_admin_or_owner());

-- Gallery
create policy "Admins and owners can manage gallery images"
  on public.gallery_images for all
  using (public.is_admin_or_owner());

-- Storage
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
