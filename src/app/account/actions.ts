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
  addons: { id: string; name: string; price: number }[],
  newTotal: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("bookings")
    .update({ addons, total_estimate: newTotal })
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
