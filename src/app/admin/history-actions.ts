"use server";

import { createClient } from "@/lib/supabase/server";
import { getCalgaryNow, parseBookingTime } from "@/lib/booking-schedule";
import type { Booking } from "@/lib/admin-history";

async function historyAdminClient() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Sign in to view appointment history.");
  const { data: profile, error: roleError } = await client.from("profiles").select("role").eq("id", user.id).single();
  if (roleError || !profile || !["admin", "owner"].includes(profile.role)) throw new Error("Admin access required.");
  return { client, user };
}

export async function getAppointmentHistoryPage(offset: number) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset % 200 !== 0) throw new Error("Invalid history page.");
  const { client } = await historyAdminClient();
  const { data, error } = await client.from("bookings").select("*")
    .lte("booking_date", getCalgaryNow().date)
    .order("booking_date", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 199);
  if (error) throw new Error("Could not load appointment history.");
  const bookings = (data ?? []) as Booking[];
  if (!bookings.length) return { bookings, payments: [], hasMore: false };
  const userIds = [...new Set(bookings.flatMap(b => b.user_id ? [b.user_id] : []))];
  const [payments, archives, profiles] = await Promise.all([
    client.from("booking_admin_details").select("booking_id,payment_status,final_amount").in("booking_id", bookings.map(b => b.id)),
    client.from("booking_admin_archives").select("booking_id,archived_at").in("booking_id", bookings.map(b => b.id)),
    userIds.length ? client.from("profiles").select("id,first_name,last_name,phone").in("id", userIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (payments.error || profiles.error || archives.error) throw new Error("Could not load customer or payment details.");
  const archived = new Map((archives.data ?? []).map(a => [a.booking_id, a.archived_at as string]));
  const names = new Map((profiles.data ?? []).map(p => [p.id, p]));
  return {
    bookings: bookings.map(b => ({ ...b, archived_at: archived.get(b.id) ?? null, profiles: b.user_id ? names.get(b.user_id) ?? null : null })),
    payments: (payments.data ?? []) as { booking_id: string; payment_status: string; final_amount: number | null }[],
    hasMore: bookings.length === 200,
  };
}


export async function setAppointmentArchived(bookingId: string, archive: boolean) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId) || typeof archive !== "boolean")
    throw new Error("Invalid archive request.");
  const { client, user } = await historyAdminClient();
  const { data: booking, error: bookingError } = await client.from("bookings").select("booking_date,booking_time").eq("id", bookingId).single();
  if (bookingError || !booking) throw new Error("Booking not found.");
  const now = getCalgaryNow();
  if (archive && (booking.booking_date > now.date || (booking.booking_date === now.date && (parseBookingTime(booking.booking_time) ?? 1440) >= now.minutes)))
    throw new Error("Only past appointments can be archived.");
  const archivedAt = new Date().toISOString();
  const result = archive
    ? await client.from("booking_admin_archives").upsert({ booking_id: bookingId, archived_at: archivedAt, archived_by: user.id }, { onConflict: "booking_id", ignoreDuplicates: true })
    : await client.from("booking_admin_archives").delete().eq("booking_id", bookingId);
  if (result.error) throw new Error(archive ? "Could not archive this appointment." : "Could not restore this appointment.");
  return { archivedAt: archive ? archivedAt : null };
}
