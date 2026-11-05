"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { bookingManageUrl, verifyBookingAccessToken } from "@/lib/booking-access";
import { getBookingDurationMinutes, getBookableTimeSlots, formatBookingTime, parseBookingTime } from "@/lib/booking-schedule";
import { getExternalUnavailableTimes } from "@/lib/google-availability";
import { syncBookingCalendar } from "@/lib/google-calendar";
import { checkRateLimit } from "@/lib/rate-limit";

class BookingChangeError extends Error {}

const cutoffMessage = "Online changes close 24 hours before the appointment. Please contact WOW CLEAN for help.";

async function eligibleBooking(token: string) {
  if (process.env.VERCEL_ENV !== "production") throw new BookingChangeError("Online changes are available on the live Calgary site.");
  const id = verifyBookingAccessToken(token);
  if (!id) throw new BookingChangeError("This booking link is invalid or expired.");
  if (!checkRateLimit(`booking-self-service:${id}`, { maxAttempts: 30, windowMs: 600000 }).allowed)
    throw new BookingChangeError("Too many attempts. Please wait and try again.");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: booking, error } = await client.from("bookings").select("*").eq("id", id).single();
  if (error || !booking || booking.status !== "confirmed") throw new BookingChangeError("Only confirmed appointments can be changed online.");
  const minutes = parseBookingTime(booking.booking_time);
  // Calgary booking time is UTC−06:00 for appointments after the November 2026 transition.
  const start = Date.parse(booking.booking_date + "T06:00:00Z") + (minutes ?? NaN) * 60000;
  if (!Number.isFinite(start) || start - Date.now() < 86400000) throw new BookingChangeError(cutoffMessage);
  const [payment, invoice, archive] = await Promise.all([
    client.from("booking_admin_details").select("payment_status").eq("booking_id", id).maybeSingle(),
    client.from("booking_square_invoices").select("booking_id").eq("booking_id", id).maybeSingle(),
    client.from("booking_admin_archives").select("booking_id").eq("booking_id", id).maybeSingle(),
  ]);
  if (payment.error || invoice.error || archive.error) throw new BookingChangeError("Could not check this booking. Please contact WOW CLEAN.");
  if (payment.data?.payment_status === "paid" || invoice.data || archive.data)
    throw new BookingChangeError("Please contact WOW CLEAN to change this booking.");
  return { client, booking, start };
}

async function availableTimes(booking: { package: string; vehicle_size: string; addons: { id: string }[] | null }, date: string) {
  const duration = getBookingDurationMinutes(booking.package, booking.vehicle_size, booking.addons ?? []);
  const slots = getBookableTimeSlots(date, new Date(), duration);
  if (!slots.length) return [];
  const publicClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  // Include the existing appointment in availability. The database also checks overlaps when saving.
  const [busy, external] = await Promise.all([
    publicClient.rpc("booking_busy_times_for_duration", { p_date: date, p_duration: duration }),
    getExternalUnavailableTimes(date, duration),
  ]);
  if (busy.error || !Array.isArray(busy.data)) throw new BookingChangeError("Could not check availability. Please try again.");
  const blocked = new Set([...busy.data, ...external]);
  return slots.filter(slot => !blocked.has(slot));
}

export async function getCustomerChangeTimes(token: string, date: string) {
  try {
    const { booking } = await eligibleBooking(token);
    return { times: await availableTimes(booking, date) };
  } catch (error) {
    return { error: error instanceof BookingChangeError ? error.message : "Could not check availability." };
  }
}

export async function changeCustomerBooking(token: string, change: {
  kind: "reschedule" | "cancel"; expectedDate: string; expectedTime: string; date?: string; time?: string;
}) {
  let saved: { id: string; booking_date: string; booking_time: string; status: string; reference_code: string; guest_email: string | null };
  try {
    if (change.kind !== "reschedule" && change.kind !== "cancel") return { error: "Choose a valid booking action." };
    const { client, booking, start } = await eligibleBooking(token);
    if (booking.booking_date !== change.expectedDate || booking.booking_time !== change.expectedTime)
      return { error: "This appointment changed. Refresh before trying again." };
    let patch: { status: string } | { booking_date: string; booking_time: string } = { status: "cancelled" };
    if (change.kind === "reschedule") {
      const minute = parseBookingTime(change.time ?? "");
      if (!change.date || minute === null) return { error: "Choose a date and available time." };
      const time = formatBookingTime(minute);
      if (!(await availableTimes(booking, change.date)).includes(time))
        return { error: "That time is unavailable. Check times again." };
      patch = { booking_date: change.date, booking_time: time };
    }
    if (start - Date.now() < 86400000) return { error: cutoffMessage };
    const result = await client.from("bookings").update(patch).eq("id", booking.id)
      .eq("status", "confirmed").eq("booking_date", booking.booking_date).eq("booking_time", booking.booking_time)
      .select("*").maybeSingle();
    if (result.error?.code === "23514") return { error: "That time is no longer available. Check times again." };
    if (result.error) return { error: "Could not save the change. Please try again." };
    if (!result.data) return { error: "This appointment changed. Refresh before trying again." };
    saved = result.data;
  } catch (error) {
    return { error: error instanceof BookingChangeError ? error.message : "Could not save the change." };
  }

  const manageUrl = bookingManageUrl(saved.id, saved.booking_date);
  const cancelled = saved.status === "cancelled";
  const summary = cancelled ? "Your appointment was cancelled." : `Your new appointment is ${saved.booking_date} at ${saved.booking_time} Calgary time.`;
  // Notifications happen after the change commits. A delivery error must not invite another save.
  const results = await Promise.allSettled([
    syncBookingCalendar(saved as Parameters<typeof syncBookingCalendar>[0]),
    (async () => {
      const key = process.env.RESEND_API_KEY;
      if (!key) return false;
      const admin = process.env.ADMIN_EMAIL || "teamwowclean@gmail.com";
      const mail = new Resend(key);
      const subject = `Booking ${cancelled ? "cancelled" : "rescheduled"} — ${saved.reference_code}`;
      const deliveries = [
        mail.emails.send({ from: "WowClean <info@wowcleancalgary.com>", to: admin, subject, text: `Customer self-service. ${summary} Reference: ${saved.reference_code}` }),
      ];
      if (saved.guest_email) deliveries.push(mail.emails.send({
        from: "WowClean <info@wowcleancalgary.com>", to: saved.guest_email, subject,
        text: `${summary}\n\nManage your booking: ${manageUrl}\nKeep this link private.`,
      }));
      return (await Promise.all(deliveries)).every(delivery => !delivery.error) && !!saved.guest_email;
    })(),
  ]);
  revalidatePath("/admin");
  revalidatePath("/account");
  const email = results[1];
  return { bookingDate: saved.booking_date, bookingTime: saved.booking_time, status: saved.status,
    token: new URL(manageUrl).hash.slice(7), summary, emailSent: email.status === "fulfilled" && email.value };
}
