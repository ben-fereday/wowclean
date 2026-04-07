-- Migration: Add blocked_slots table for admin time blocking
-- Run this in your Supabase SQL Editor

CREATE TABLE public.blocked_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocked_date date NOT NULL,
  blocked_time text, -- null = whole day blocked
  reason text,
  created_by uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;

-- Anyone can read blocked slots (needed for availability checks)
CREATE POLICY "Anyone can view blocked slots"
  ON public.blocked_slots FOR SELECT
  USING (true);

-- Only admins/owners can manage blocked slots
CREATE POLICY "Admins can manage blocked slots"
  ON public.blocked_slots FOR ALL
  USING (public.is_admin_or_owner());
