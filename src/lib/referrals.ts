"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export interface ReferralValidationResult {
  valid: boolean;
  error?: string;
  referrer_id?: string;
}

/**
 * Validate a referral code.
 * Rules:
 * - Code must belong to an existing account
 * - User can't use their own code
 * - Each user can only be referred once (checked via referrals table unique constraint)
 * - Guests (not logged in) cannot use referral codes
 */
export async function validateReferralCode(
  code: string,
  userId: string | null
): Promise<ReferralValidationResult> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) {
    return { valid: false, error: "Enter a referral code." };
  }

  if (!/^[A-Z0-9]{6,12}$/.test(trimmed)) {
    return { valid: false, error: "Invalid referral code format." };
  }

  if (!userId) {
    return { valid: false, error: "Please log in to use a referral code." };
  }

  // Rate limit: 10 attempts per 15 min
  const rl = checkRateLimit(`referral:${userId}`, { maxAttempts: 10 });
  if (!rl.allowed) {
    return { valid: false, error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  // Find the referrer
  const { data: referrer, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, referral_code")
    .eq("referral_code", trimmed)
    .maybeSingle();

  if (lookupErr) {
    console.error("Referral lookup error:", lookupErr);
    return { valid: false, error: "Couldn't validate that code right now." };
  }

  if (!referrer) {
    return { valid: false, error: "That referral code doesn't exist." };
  }

  if (referrer.id === userId) {
    return { valid: false, error: "You can't use your own referral code." };
  }

  // Check if user has already been referred
  const { data: existing } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_id", userId)
    .maybeSingle();

  if (existing) {
    return {
      valid: false,
      error: "You've already used a referral code.",
    };
  }

  return { valid: true, referrer_id: referrer.id };
}

/**
 * Record a referral and credit the referrer.
 * Called after a booking is successfully created.
 */
export async function recordReferral(
  referrerId: string,
  referredId: string,
  bookingId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error: insertErr } = await supabase.from("referrals").insert({
    referrer_id: referrerId,
    referred_id: referredId,
    booking_id: bookingId,
  });

  if (insertErr) {
    // Unique constraint violation = already referred
    if (insertErr.code === "23505") {
      return { error: "Already referred." };
    }
    console.error("Referral insert error:", insertErr);
    return { error: insertErr.message };
  }

  // Increment referrer's credits
  const { error: creditErr } = await supabase.rpc("increment_referral_credits", {
    user_id_input: referrerId,
  });

  if (creditErr) {
    console.error("Credit increment error:", creditErr);
    // Don't fail — the referral was still recorded
  }

  return {};
}
