"use server";

import { createClient } from "@/lib/supabase/server";
import { generateRefCode } from "@/lib/constants";
import { checkTimeSlotAvailable } from "@/lib/availability";
import { Resend } from "resend";

export type BookingPayload = {
  vehicleSize: string;
  serviceType: string;
  packageId: string;
  packageName: string;
  addons: { id: string; name: string; price: number }[];
  date: string;
  time: string;
  location: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColour: string;
  notes: string;
  basePrice: number;
  addonsTotal: number;
  estimatedTotal: number;
};

export type BookingResult = {
  success: boolean;
  refCode?: string;
  error?: string;
};

export async function createBooking(
  data: BookingPayload
): Promise<BookingResult> {
  try {
    // Check for time slot conflicts (2-hour buffer)
    const slotCheck = await checkTimeSlotAvailable(data.date, data.time);
    if (!slotCheck.available) {
      return { success: false, error: slotCheck.reason };
    }

    const supabase = await createClient();
    const refCode = generateRefCode();

    // Get user_id if logged in
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("bookings").insert({
      user_id: user?.id ?? null,
      reference_code: refCode,
      vehicle_size: data.vehicleSize,
      service_type: data.serviceType,
      package: data.packageId,
      addons: data.addons,
      total_estimate: data.estimatedTotal,
      booking_date: data.date,
      booking_time: data.time,
      location: data.location,
      guest_first_name: data.firstName,
      guest_last_name: data.lastName,
      guest_phone: data.phone,
      guest_email: data.email,
      service_address: data.location === "mobile" ? data.address : null,
      vehicle_make: data.vehicleMake,
      vehicle_model: data.vehicleModel,
      vehicle_colour: data.vehicleColour,
      notes: data.notes,
      status: "confirmed",
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return { success: false, error: "Failed to create booking." };
    }

    // Send confirmation emails via Resend
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0b1740;color:#fff;padding:40px;border-radius:12px;">
          <h1 style="color:#5bf3ff;font-size:28px;margin-bottom:8px;">Booking Confirmed!</h1>
          <p style="color:#7a8baa;margin-bottom:24px;">Reference: <strong style="color:#fff;">${refCode}</strong></p>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Customer</td><td style="padding:8px 0;color:#fff;text-align:right;">${data.firstName} ${data.lastName}</td></tr>
            <tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Vehicle</td><td style="padding:8px 0;color:#fff;text-align:right;">${data.vehicleSize} — ${data.vehicleMake} ${data.vehicleModel}</td></tr>
            <tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Package</td><td style="padding:8px 0;color:#fff;text-align:right;">${data.packageName} (${data.serviceType})</td></tr>
            <tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Date & Time</td><td style="padding:8px 0;color:#fff;text-align:right;">${data.date} at ${data.time}</td></tr>
            <tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Location</td><td style="padding:8px 0;color:#fff;text-align:right;">${data.location === "mobile" ? "Mobile Service" : "In-Shop"}</td></tr>
            ${data.addons.length > 0 ? `<tr><td style="padding:8px 0;color:#7a8baa;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Add-Ons</td><td style="padding:8px 0;color:#fff;text-align:right;">${data.addons.map((a) => a.name).join(", ")}</td></tr>` : ""}
            <tr style="border-top:1px solid rgba(255,255,255,0.1);"><td style="padding:16px 0 8px;color:#5bf3ff;font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Estimated Total</td><td style="padding:16px 0 8px;color:#5bf3ff;font-size:24px;font-weight:bold;text-align:right;">$${data.estimatedTotal}</td></tr>
          </table>
          <p style="color:#7a8baa;font-size:13px;margin-top:24px;line-height:1.6;">We'll follow up with a reminder 24 hours before your appointment. Questions? Call WOW CLEAN.</p>
        </div>
      `;

      // Send to customer
      await resend.emails.send({
        from: "WowClean <bookings@wowclean.ca>",
        to: data.email,
        subject: `Booking Confirmed — ${refCode}`,
        html: emailHtml,
      });

      // Send to admin
      if (process.env.ADMIN_EMAIL) {
        await resend.emails.send({
          from: "WowClean <bookings@wowclean.ca>",
          to: process.env.ADMIN_EMAIL,
          subject: `New Booking — ${refCode} — ${data.firstName} ${data.lastName}`,
          html: emailHtml,
        });
      }
    } catch (emailError) {
      console.error("Email send error:", emailError);
      // Don't fail the booking if email fails
    }

    return { success: true, refCode };
  } catch (err) {
    console.error("Booking error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
