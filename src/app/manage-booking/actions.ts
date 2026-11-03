"use server";

import { readManagedBooking } from "@/lib/booking-access";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCalgaryNow, parseBookingTime } from "@/lib/booking-schedule";
import { Resend } from "resend";

export async function getManagedBooking(token: string) {
  const booking = await readManagedBooking(token);
  if (!booking) return null;
  // Never return contact email, IDs, internal notes or payment records to the public page.
  const { guest_email: _email, id: _id, ...details } = booking;
  return details;
}

export async function requestBookingChange(token: string, kind: string, message: string) {
  if (!["reschedule", "cancel", "other"].includes(kind) || typeof message !== "string" || message.trim().length < 10 || message.length > 1500)
    return { error: "Choose a request type and enter 10–1,500 characters." };
  const booking = await readManagedBooking(token);
  if (!booking) return { error: "This booking link is invalid or expired. Please contact WOW CLEAN." };
  const now = getCalgaryNow();
  if (booking.status !== "confirmed" || booking.booking_date < now.date || (booking.booking_date === now.date && (parseBookingTime(booking.booking_time) ?? 0) <= now.minutes))
    return { error: "For past or inactive bookings, please call or email WOW CLEAN directly." };
  const limit = checkRateLimit("booking-change:" + booking.id, { maxAttempts: 3, windowMs: 3600000 });
  if (!limit.allowed) return { error: "Please wait before sending another request, or contact us directly." };
  if (!process.env.RESEND_API_KEY) return { error: "Requests are temporarily unavailable. Please call or email us." };
  const name = booking.guest_first_name || "Customer";
  const labels: Record<string, string> = { reschedule: "Reschedule", cancel: "Cancellation", other: "Other change" };
  const text = [
    labels[kind] + " request for " + booking.reference_code,
    "Customer: " + name, "Appointment: " + booking.booking_date + " at " + booking.booking_time + " (Calgary time)",
    "", message.trim(), "", "This is a request only. The booking has not changed. Contact the customer to confirm, then update the booking in the admin dashboard.",
    "https://wowcleancalgary.com/admin",
  ].join("\n");
  try {
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: "WowClean <info@wowcleancalgary.com>", to: process.env.ADMIN_EMAIL || "teamwowclean@gmail.com",
      ...(booking.guest_email ? { replyTo: booking.guest_email } : {}),
      subject: labels[kind] + " request — " + booking.reference_code, text,
    }, {
      // At most one accepted email per booking per hour across server instances.
      idempotencyKey: "booking-change-" + booking.id + "-" + Math.floor(Date.now() / 3600000),
    });
    if (result.error) {
      if (result.error.name === "invalid_idempotent_request") return { error: "A request was already sent recently. Please call or email us for a follow-up." };
      return { error: "Could not send your request. Please call or email us." };
    }
    return { success: true };
  } catch { return { error: "Could not send your request. Please call or email us." }; }
}
