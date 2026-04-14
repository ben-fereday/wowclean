"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SubscriptionPlan } from "@/lib/constants";

export async function updateSubscription(
  subscriptionId: string,
  data: {
    plan?: SubscriptionPlan;
    recurring_day?: string;
    recurring_time?: string;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("subscriptions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", subscriptionId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/account");
}

export async function cancelSubscription(subscriptionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("subscriptions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", subscriptionId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/account");
}

export async function updateProfile(data: { phone?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/account");
}

export async function updateEmail(newEmail: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) return { error: error.message };
  return { success: true, message: "Check your new email to confirm the change." };
}

export async function updateBookingAddons(
  bookingId: string,
  addons: { id: string; name: string; price: number }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch the booking to get base price info
  const { data: booking } = await supabase
    .from("bookings")
    .select("package, vehicle_size, service_type, promo_discount_pct")
    .eq("id", bookingId)
    .eq("user_id", user.id)
    .single();

  if (!booking) throw new Error("Booking not found");

  // Re-validate addon prices from DB
  const { data: dbAddons } = await supabase
    .from("addon_items")
    .select("id, name, price")
    .eq("active", true);

  const addonMap = new Map((dbAddons ?? []).map((a: { id: string; name: string; price: number }) => [a.id, a]));
  const validatedAddons = addons
    .filter((a) => addonMap.has(a.id))
    .map((a) => {
      const db = addonMap.get(a.id)!;
      return { id: db.id, name: db.name, price: db.price };
    });

  // Re-fetch base price from DB
  const { data: priceRow } = await supabase
    .from("booking_prices")
    .select("price")
    .eq("package", booking.package)
    .eq("vehicle_size", booking.vehicle_size)
    .eq("service_type", booking.service_type)
    .single();

  const basePrice = priceRow?.price ?? 0;
  const addonsTotal = validatedAddons.reduce((sum, a) => sum + a.price, 0);
  let total = basePrice + addonsTotal;

  // Re-apply promo discount if one was used
  if (booking.promo_discount_pct) {
    total = Math.round(total * (1 - booking.promo_discount_pct / 100));
  }

  const { error } = await supabase
    .from("bookings")
    .update({ addons: validatedAddons, total_estimate: total })
    .eq("id", bookingId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/account");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
