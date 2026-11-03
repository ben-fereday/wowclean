-- Private admin metadata only. Archiving never updates the appointment, sends
-- notifications, or touches payment / invoice / calendar records.
create table public.booking_admin_archives (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  archived_at timestamptz not null default now(),
  archived_by uuid references auth.users(id) on delete set null
);
alter table public.booking_admin_archives enable row level security;
revoke all on public.booking_admin_archives from public, anon, authenticated;
grant select, insert, delete on public.booking_admin_archives to authenticated;
grant all on public.booking_admin_archives to service_role;
create policy "Admins read booking archives"
  on public.booking_admin_archives for select to authenticated
  using ((select public.is_admin_or_owner()));
create policy "Admins archive bookings"
  on public.booking_admin_archives for insert to authenticated
  with check ((select public.is_admin_or_owner()) and archived_by = (select auth.uid()));
create policy "Admins restore bookings"
  on public.booking_admin_archives for delete to authenticated
  using ((select public.is_admin_or_owner()));
