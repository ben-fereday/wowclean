"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  SubscriptionPlan,
  PackageId,
  VehicleSize,
  LocationType,
  BillingCycle,
} from "@/lib/constants";
import {
  checkSubscriptionSlotAvailable,
  checkSubscriptionStartConflict,
} from "@/lib/availability";
import { validatePromoCode } from "@/lib/promo-codes";
import { checkRateLimit } from "@/lib/rate-limit";

interface CreateSubscriptionData {
  plan: SubscriptionPlan;
  package_id: PackageId;
  vehicle_size: VehicleSize;
  billing_cycle: BillingCycle;
  start_date: string;
  time_slot: string;
  location: LocationType;
  address?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_colour?: string;
  notes?: string;
  promo_code?: string | null;
}

function dayOfWeekFromDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function daysFromToday(dateStr: string): number {
  const target = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
}

export async function createSubscription(data: CreateSubscriptionData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be logged in to create a subscription." };
  }

  // Rate limit: 5 subscription attempts per 15 minutes
  const rl = checkRateLimit(`subscription:${user.id}`, { maxAttempts: 5 });
  if (!rl.allowed) {
    return { error: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.` };
  }

  if (daysFromToday(data.start_date) < 3) {
    return {
      error: "Start date must be at least 3 days from today.",
    };
  }

  const recurringDay = dayOfWeekFromDate(data.start_date);

  // Conflict with another subscription on the same recurring weekday/time
  const recurringCheck = await checkSubscriptionSlotAvailable(
    recurringDay,
    data.time_slot
  );
  if (!recurringCheck.available) {
    return { error: recurringCheck.reason };
  }

  // Conflict on the actual start date with bookings, blocked slots, or other subs
  const startCheck = await checkSubscriptionStartConflict(
    data.start_date,
    data.time_slot
  );
  if (!startCheck.available) {
    return { error: startCheck.reason };
  }

  // Re-validate promo code server-side
  let promoCodeText: string | null = null;
  let promoDiscountPct: number | null = null;
  let promoCodeId: string | null = null;
  if (data.promo_code && data.promo_code.trim()) {
    const result = await validatePromoCode(
      data.promo_code,
      "subscription",
      user.id
    );
    if (!result.valid) {
      return { error: result.error || "Invalid promo code." };
    }
    promoCodeText = result.code_text ?? null;
    promoDiscountPct = result.discount_pct ?? null;
    promoCodeId = result.code_id ?? null;
  }

  const { data: inserted, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan: data.plan,
      package: data.package_id,
      service_type: "full",
      vehicle_size: data.vehicle_size,
      billing_cycle: data.billing_cycle,
      recurring_day: recurringDay,
      recurring_time: data.time_slot,
      location: data.location,
      service_address: data.address || null,
      vehicle_make: data.vehicle_make || null,
      vehicle_model: data.vehicle_model || null,
      vehicle_colour: data.vehicle_colour || null,
      notes: data.notes || null,
      start_date: data.start_date,
      next_service_date: data.start_date,
      promo_code: promoCodeText,
      promo_discount_pct: promoDiscountPct,
      promo_code_id: promoCodeId,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Subscription insert error:", error);
    return { error: "Failed to create subscription. Please try again." };
  }

  if (promoCodeId && inserted?.id) {
    const { error: redErr } = await supabase
      .from("promo_redemptions")
      .insert({
        promo_code_id: promoCodeId,
        user_id: user.id,
        subscription_id: inserted.id,
      });
    if (redErr) {
      console.error("Subscription redemption insert error:", redErr);
    }
  }

  return { success: true };
}
