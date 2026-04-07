-- Allow users to update their own bookings (for editing add-ons)
CREATE POLICY "Users can update own bookings"
  ON public.bookings FOR UPDATE
  USING (auth.uid() = user_id);
