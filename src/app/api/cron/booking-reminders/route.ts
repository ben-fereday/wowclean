import { timingSafeEqual } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { bookingManageUrl } from "@/lib/booking-access";
import { getCalgaryNow } from "@/lib/booking-schedule";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (process.env.VERCEL_ENV !== "production") return new Response(null, { status: 404 });

  const secret = process.env.CRON_SECRET;
  const authorization = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || authorization.length !== expected.length || !timingSafeEqual(authorization, expected)) {
    return new Response(null, { status: 401 });
  }

  const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SECRET_KEY: databaseKey, RESEND_API_KEY: emailKey } = process.env;
  if (!url || !databaseKey || !emailKey) {
    console.error("Booking reminder configuration is incomplete.");
    return new Response(null, { status: 503 });
  }

  const appointmentDay = new Date(getCalgaryNow().date + "T12:00:00Z");
  appointmentDay.setUTCDate(appointmentDay.getUTCDate() + 2);
  const date = appointmentDay.toISOString().slice(0, 10);
  const client = createClient(url, databaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: bookings, error } = await client.from("bookings")
    .select("id,reference_code,guest_email,booking_time,service_type,booking_admin_archives(booking_id)")
    .eq("booking_date", date)
    .eq("status", "confirmed")
    .not("guest_email", "is", null)
    .is("booking_admin_archives", null)
    .order("id");
  if (error) {
    console.error("Booking reminder lookup failed.");
    return new Response(null, { status: 502 });
  }

  const dateLabel = appointmentDay.toLocaleDateString("en-CA", {
    weekday: "long", month: "long", day: "numeric", timeZone: "UTC",
  });
  const resend = new Resend(emailKey);
  let accepted = 0;
  let failed = 0;
  for (const booking of bookings) {
    const email = booking.guest_email?.trim();
    if (!email) continue;
    if (accepted + failed > 0) await delay(550);
    try {
      const supplies = booking.service_type === "interior"
        ? "Please have power available. In winter, have a suitable heated indoor workspace where detailing is permitted."
        : "Please have water and power available at a location where detailing is permitted.";
      const result = await resend.emails.send({
        from: "WowClean <info@wowcleancalgary.com>",
        to: email,
        subject: "Your upcoming WOW CLEAN appointment",
        text: [
          `Your Calgary detailing appointment is on ${dateLabel} at ${booking.booking_time} (Calgary time).`,
          `Booking reference: ${booking.reference_code}`,
          `Before we arrive, please clear personal items from the vehicle. ${supplies}`,
          "Need to change the time or cancel? You can do so online up to 24 hours before your appointment. For changes after that, call (587) 436-9605.",
          `Manage your booking: ${bookingManageUrl(booking.id, date)}`,
          "Keep this link private. Anyone with it can manage your appointment.",
        ].join("\n\n"),
      }, { idempotencyKey: `booking-reminder/${booking.id}/${date}` });
      // A changed time or recipient after a prior send can make the payload differ.
      // Resend still blocks a second reminder for that booking on the same day.
      if (result.error && result.error.name !== "invalid_idempotent_request") failed++;
      else accepted++;
    } catch {
      failed++;
    }
  }

  if (failed) console.error("Booking reminder delivery failed.", { failed });
  return Response.json({ accepted, failed }, { status: failed ? 502 : 200 });
}
