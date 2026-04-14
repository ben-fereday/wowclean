"use server";

import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import type { PromoScope } from "@/lib/constants";

export interface PromoValidationResult {
  valid: boolean;
  error?: string;
  code_id?: string;
  code_text?: string;
  discount_pct?: number;
}

/**
 * Validate a promo code for a given scope and (optional) user.
 * Enforces: code exists, scope match, active=true, and per-user use limits.
 * If userId is null (guest checkout), per-user limits are skipped — those
 * codes are still allowed for guests because there's no account to count
 * against.
 */
export async function validatePromoCode(
  rawCode: string,
  scope: PromoScope,
  userId: string | null
): Promise<PromoValidationResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, error: "Enter a promo code." };
  }

  // Format validation
  if (!/^[A-Z0-9_-]{1,30}$/.test(code)) {
    return { valid: false, error: "Invalid code format." };
  }

  // Rate limit: 10 attempts per 15 minutes per user/scope combo
  const rlKey = `promo:${userId ?? "anon"}:${scope}`;
  const rl = checkRateLimit(rlKey, { maxAttempts: 10 });
  if (!rl.allowed) {
    return { valid: false, error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();

  const { data: promo, error } = await supabase
    .from("promo_codes")
    .select("id, code, discount_pct, scope, max_uses_per_user, active")
    .eq("code", code)
    .eq("scope", scope)
    .maybeSingle();

  if (error) {
    console.error("Promo lookup error:", error);
    return { valid: false, error: "Couldn't validate that code right now." };
  }

  if (!promo) {
    return { valid: false, error: "That promo code isn't valid." };
  }

  if (!promo.active) {
    return { valid: false, error: "That promo code is no longer active." };
  }

  if (promo.max_uses_per_user !== null && !userId) {
    return {
      valid: false,
      error: "Please log in to use this code.",
    };
  }

  if (userId && promo.max_uses_per_user !== null) {
    const { count, error: countErr } = await supabase
      .from("promo_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promo_code_id", promo.id)
      .eq("user_id", userId);

    if (countErr) {
      console.error("Redemption count error:", countErr);
      return { valid: false, error: "Couldn't validate that code right now." };
    }

    if ((count ?? 0) >= promo.max_uses_per_user) {
      return {
        valid: false,
        error: "You've already used this code.",
      };
    }
  }

  return {
    valid: true,
    code_id: promo.id,
    code_text: promo.code,
    discount_pct: promo.discount_pct,
  };
}
