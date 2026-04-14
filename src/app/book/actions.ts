"use server";

import { createClient } from "@/lib/supabase/server";
import { applyDiscount, generateRefCode } from "@/lib/constants";
import { checkTimeSlotAvailable } from "@/lib/availability";
import { validatePromoCode } from "@/lib/promo-codes";
import { validateReferralCode, recordReferral } from "@/lib/referrals";
import { checkRateLimit } from "@/lib/rate-limit";
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
  promoCode?: string | null;
  referralCode?: string | null;
  redeemCredits?: boolean;
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
    // Rate limit by email (10 bookings per 15 min)
    const rlKey = `booking:${data.email.toLowerCase()}`;
    const rl = checkRateLimit(rlKey, { maxAttempts: 10 });
    if (!rl.allowed) {
      return { success: false, error: `Too many booking attempts. Try again in ${rl.retryAfterSeconds}s.` };
    }

    // Check for time slot conflicts (2-hour buffer)
    const slotCheck = await checkTimeSlotAvailable(data.date, data.time);
    if (!slotCheck.available) {
      return { success: false, error: slotCheck.reason };
    }

    const supabase = await createClient();
    const refCode = generateRefCode();

    // Get user_id if logged in
    const { data: { user } } = await supabase.auth.getUser();

    // Validate referral credit redemption
    if (data.redeemCredits) {
      if (!user) {
        return { success: false, error: "You must be logged in to redeem credits." };
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_credits")
        .eq("id", user.id)
        .single();
      if (!profile || (profile.referral_credits ?? 0) < 3) {
        return { success: false, error: "You don't have enough referral credits (3 required)." };
      }
    }

    // Re-validate promo code server-side and snapshot the discount
    let promoCodeText: string | null = null;
    let promoDiscountPct: number | null = null;
    let promoCodeId: string | null = null;
    const subtotal = data.basePrice + data.addonsTotal;
    let finalTotal = subtotal;

    if (data.promoCode && data.promoCode.trim()) {
      const result = await validatePromoCode(
        data.promoCode,
        "booking",
        user?.id ?? null
      );
      if (!result.valid) {
        return { success: false, error: result.error || "Invalid promo code." };
      }
      promoCodeText = result.code_text ?? null;
      promoDiscountPct = result.discount_pct ?? null;
      promoCodeId = result.code_id ?? null;
      finalTotal = applyDiscount(subtotal, promoDiscountPct);
    }

    // Apply referral credit redemption discount (free base price)
    if (data.redeemCredits) {
      finalTotal = finalTotal - data.basePrice;
      if (finalTotal < 0) finalTotal = 0;
    }

    // Re-validate referral code server-side
    let referrerId: string | null = null;
    if (data.referralCode && data.referralCode.trim()) {
      const refResult = await validateReferralCode(
        data.referralCode,
        user?.id ?? null
      );
      if (!refResult.valid) {
        return { success: false, error: refResult.error || "Invalid referral code." };
      }
      referrerId = refResult.referrer_id ?? null;
      // Apply 10% referral discount on top of any promo discount
      finalTotal = applyDiscount(finalTotal, 10);
    }

    const { data: inserted, error } = await supabase
      .from("bookings")
      .insert({
        user_id: user?.id ?? null,
        reference_code: refCode,
        vehicle_size: data.vehicleSize,
        service_type: data.serviceType,
        package: data.packageId,
        addons: data.addons,
        total_estimate: finalTotal,
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
        promo_code: promoCodeText,
        promo_discount_pct: promoDiscountPct,
        status: "confirmed",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return { success: false, error: "Failed to create booking." };
    }

    // Record redemption (only if user is logged in — guests can't use
    // one-time codes against an account, but unlimited codes work for them
    // since there's no limit to enforce)
    if (user && promoCodeId && inserted?.id) {
      const { error: redErr } = await supabase
        .from("promo_redemptions")
        .insert({
          promo_code_id: promoCodeId,
          user_id: user.id,
          booking_id: inserted.id,
        });
      if (redErr) {
        console.error("Redemption insert error:", redErr);
        // Don't fail the booking — the discount was already applied
      }
    }

    // Record referral and credit the referrer
    if (user && referrerId && inserted?.id) {
      await recordReferral(referrerId, user.id, inserted.id);
    }

    // Deduct 3 referral credits if redeeming a free detail
    if (user && data.redeemCredits) {
      const { error: redeemErr } = await supabase.rpc("redeem_referral_credits", {
        user_id_input: user.id,
      });
      if (redeemErr) {
        console.error("Credit redeem error:", redeemErr);
        // Don't fail the booking — the discount was already applied
      }
    }

    // Override the email's "Estimated Total" with finalTotal
    data = { ...data, estimatedTotal: finalTotal };

    // Send confirmation emails via Resend
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const addonsHtml = data.addons.length > 0
        ? data.addons.map((a) => `<span style="display:inline-block;background:rgba(91,243,255,0.1);border:1px solid rgba(91,243,255,0.2);color:#5bf3ff;padding:4px 10px;border-radius:6px;font-size:12px;margin:2px 4px 2px 0;">${a.name} +$${a.price}</span>`).join("")
        : "";

      const dateDisplay = new Date(data.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#070d22;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#1262d4,#1a4aff);padding:32px 40px;text-align:center;">
            <h1 style="color:#fff;font-size:32px;margin:0 0 4px;letter-spacing:2px;font-weight:800;">WOW CLEAN</h1>
            <p style="color:rgba(255,255,255,0.7);font-size:14px;margin:0;letter-spacing:1px;text-transform:uppercase;">Booking Confirmed</p>
          </div>
          <div style="padding:32px 40px;">
            <div style="text-align:center;margin-bottom:24px;">
              <div style="display:inline-block;background:rgba(91,243,255,0.1);border:1px solid rgba(91,243,255,0.2);border-radius:8px;padding:8px 20px;">
                <span style="color:#7a8baa;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Reference Code</span><br/>
                <span style="color:#5bf3ff;font-size:20px;font-weight:bold;letter-spacing:2px;">${refCode}</span>
              </div>
            </div>
            <p style="color:#fff;font-size:16px;margin-bottom:24px;">Hi ${data.firstName}, your detail is booked! Here are the details:</p>
            <div style="background:#0b1740;border-radius:12px;padding:20px;margin-bottom:16px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:10px 0;color:#7a8baa;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.06);">Date</td><td style="padding:10px 0;color:#fff;text-align:right;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${dateDisplay}</td></tr>
                <tr><td style="padding:10px 0;color:#7a8baa;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.06);">Time</td><td style="padding:10px 0;color:#5bf3ff;text-align:right;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${data.time}</td></tr>
                <tr><td style="padding:10px 0;color:#7a8baa;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.06);">Package</td><td style="padding:10px 0;color:#fff;text-align:right;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.06);">${data.packageName}</td></tr>
                <tr><td style="padding:10px 0;color:#7a8baa;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.06);">Service</td><td style="padding:10px 0;color:#fff;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">${data.serviceType}</td></tr>
                <tr><td style="padding:10px 0;color:#7a8baa;font-size:12px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.06);">Vehicle</td><td style="padding:10px 0;color:#fff;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">${data.vehicleMake ? `${data.vehicleMake} ${data.vehicleModel}` : data.vehicleSize}</td></tr>
                <tr><td style="padding:10px 0;color:#7a8baa;font-size:12px;text-transform:uppercase;letter-spacing:1px;">${data.location === "mobile" ? "Address" : "Location"}</td><td style="padding:10px 0;color:#fff;text-align:right;">${data.location === "mobile" ? data.address || "Mobile" : "In-Shop"}</td></tr>
              </table>
            </div>
            ${addonsHtml ? `<div style="margin-bottom:16px;"><p style="color:#7a8baa;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Add-Ons</p>${addonsHtml}</div>` : ""}
            <div style="background:linear-gradient(135deg,rgba(91,243,255,0.1),rgba(26,74,255,0.1));border:1px solid rgba(91,243,255,0.15);border-radius:12px;padding:20px;text-align:center;">
              <p style="color:#7a8baa;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px;">Estimated Total</p>
              <p style="color:#5bf3ff;font-size:36px;font-weight:800;margin:0;letter-spacing:1px;">$${data.estimatedTotal}</p>
            </div>
            <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="color:#7a8baa;font-size:13px;line-height:1.6;margin:0;">Questions? Call <a href="tel:+15878913265" style="color:#5bf3ff;text-decoration:none;">(587) 891-3265</a> or email <a href="mailto:teamwowclean@gmail.com" style="color:#5bf3ff;text-decoration:none;">teamwowclean@gmail.com</a></p>
            </div>
          </div>
        </div>
      `;

      // Send to customer
      await resend.emails.send({
        from: "WowClean <info@wowcleancalgary.com>",
        to: data.email,
        subject: `Booking Confirmed — ${refCode}`,
        html: emailHtml,
      });

      // Send to admin
      if (process.env.ADMIN_EMAIL) {
        await resend.emails.send({
          from: "WowClean <info@wowcleancalgary.com>",
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
