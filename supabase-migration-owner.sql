-- Migration: Add role-based access (owner > admin > customer)
-- Run this in your Supabase SQL Editor
-- NOTE: You must sign up with teamwowclean@gmail.com BEFORE running this migration

-- 1. Add role column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role text DEFAULT 'customer'
CHECK (role IN ('customer', 'admin', 'owner'));

-- 2. Migrate existing is_admin data to role
UPDATE public.profiles SET role = 'admin' WHERE is_admin = true;

-- 3. Set teamwowclean@gmail.com as owner
UPDATE public.profiles
SET role = 'owner'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'teamwowclean@gmail.com'
);

-- 4. Drop ALL old policies that depend on is_admin BEFORE dropping the column
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update any booking" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can update any subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can manage gallery images" ON public.gallery_images;
DROP POLICY IF EXISTS "Admins can upload gallery files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete gallery files" ON storage.objects;

-- 5. Now safe to drop the old column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;

-- 6. Recreate all policies using role

-- Profiles
CREATE POLICY "Admins and owners can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Owner can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'owner'
    )
  );

-- Bookings
CREATE POLICY "Admins and owners can view all bookings"
  ON public.bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins and owners can update any booking"
  ON public.bookings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Subscriptions
CREATE POLICY "Admins and owners can view all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins and owners can update any subscription"
  ON public.subscriptions FOR update
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Gallery
CREATE POLICY "Admins and owners can manage gallery images"
  ON public.gallery_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Storage
CREATE POLICY "Admins and owners can upload gallery files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins and owners can delete gallery files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gallery' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- 7. Helper function: find user by email (needed for admin management)
CREATE OR REPLACE FUNCTION public.find_user_by_email(search_email text)
RETURNS TABLE(id uuid, email text) AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT au.id, au.email::text
  FROM auth.users au
  WHERE au.email = search_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
