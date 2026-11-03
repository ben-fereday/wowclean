import "server-only";
import { normalizeBookingEmail } from "./promo-policy";
import type { PromoValidationResult } from "./promo-codes";

export async function previewBookingPromo(code: string, email: string): Promise<PromoValidationResult> {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    return { valid: false, error: "Promo codes are temporarily unavailable. Please try again later." };
  const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/rpc/preview_booking_promo", {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_SECRET_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_code: code, p_email: normalizeBookingEmail(email) }),
    cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return { valid: false, error: "Couldn’t validate that code right now. Please retry." };
  return response.json();
}
