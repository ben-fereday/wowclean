"use server";

import { createClient } from "@/lib/supabase/server";
import { getCalgaryNow } from "@/lib/booking-schedule";
import type { Booking } from "@/lib/admin-history";

export async function getAppointmentHistoryPage(offset: number) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset % 200 !== 0) throw new Error("Invalid history page.");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Sign in to view appointment history.");
  const { data: profile, error: roleError } = await client.from("profiles").select("role").eq("id", user.id).single();
  if (roleError || !profile || !["admin", "owner"].includes(profile.role)) throw new Error("Admin access required.");
  const { data, error } = await client.from("bookings").select("*")
    .lte("booking_date", getCalgaryNow().date)
    .order("booking_date", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 199);
  if (error) throw new Error("Could not load appointment history.");
  const bookings = (data ?? []) as Booking[];
  if (!bookings.length) return { bookings, payments: [], hasMore: false };
  const userIds = [...new Set(bookings.flatMap(b => b.user_id ? [b.user_id] : []))];
  const [payments, profiles] = await Promise.all([
    client.from("booking_admin_details").select("booking_id,payment_status,final_amount").in("booking_id", bookings.map(b => b.id)),
    userIds.length ? client.from("profiles").select("id,first_name,last_name,phone").in("id", userIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (payments.error || profiles.error) throw new Error("Could not load customer or payment details.");
  const names = new Map((profiles.data ?? []).map(p => [p.id, p]));
  return {
    bookings: bookings.map(b => ({ ...b, profiles: b.user_id ? names.get(b.user_id) ?? null : null })),
    payments: (payments.data ?? []) as { booking_id: string; payment_status: string; final_amount: number | null }[],
    hasMore: bookings.length === 200,
  };
}
