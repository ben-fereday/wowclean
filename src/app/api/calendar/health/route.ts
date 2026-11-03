import { getExternalUnavailableTimes, availabilityCalendarIds } from "@/lib/google-availability";
import { getCalgaryNow } from "@/lib/booking-schedule";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { checkCalendarConnection, syncBookingCalendar, type CalendarBooking } from "@/lib/google-calendar";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function authorized(request: Request) {
  const secret = process.env.GOOGLE_CALENDAR_HEALTH_TOKEN;
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from("Bearer " + secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await checkCalendarConnection();
  try {
    const date = new URL(request.url).searchParams.get("date") || getCalgaryNow().date;
    const blocked = await getExternalUnavailableTimes(date, 120);
    return Response.json({ ...result, availability: { success: true, calendarCount: availabilityCalendarIds().length, blockedStarts: blocked } }, { status: result.success ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ success: false, error: "Could not access all six availability calendars." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
// Protected integration check uses synthetic details, never customer data or invitations.
export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const booking: CalendarBooking = {
    id: randomUUID(), reference_code: "CALENDAR-CONNECTION-TEST", booking_date: "2099-01-03",
    booking_time: "2:30 PM", package: "premium", vehicle_size: "large", service_type: "interior",
    status: "confirmed", addons: [{ id: "seat_shamp", name: "Seat Shampoo" }],
    guest_first_name: "Calendar connection test",
  };
  let created = false;
  let updated = false;
  let removed = false;
  try {
    created = (await syncBookingCalendar(booking)).success;
    if (created) updated = (await syncBookingCalendar({ ...booking, booking_time: "3:00 PM" })).success;
  } finally {
    removed = (await syncBookingCalendar({ ...booking, status: "cancelled" })).success;
  }
  const success = created && updated && removed;
  return Response.json({ success, created, updated, removed }, { status: success ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
