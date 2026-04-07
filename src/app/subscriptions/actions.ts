"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  SubscriptionPlan,
  PackageId,
  ServiceType,
  VehicleSize,
  LocationType,
} from "@/lib/constants";
import { getPrice } from "@/lib/constants";
import { checkSubscriptionSlotAvailable } from "@/lib/availability";

interface CreateSubscriptionData {
  plan: SubscriptionPlan;
  package_id: PackageId;
  service_type: ServiceType;
  vehicle_size: VehicleSize;
  recurring_day: string;
  time_slot: string;
  location: LocationType;
  address?: string;
  start_date?: string;
}

function getNextServiceDate(recurringDay: string): string {
  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };

  const targetDay = dayMap[recurringDay];
  const now = new Date();
  let daysUntil = targetDay - now.getDay();
  if (daysUntil <= 0) daysUntil += 7;

  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysUntil);

  // Use local date to avoid UTC timezone shift
  const yyyy = nextDate.getFullYear();
  const mm = String(nextDate.getMonth() + 1).padStart(2, "0");
  const dd = String(nextDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

  // Check for time slot conflicts
  const slotCheck = await checkSubscriptionSlotAvailable(data.recurring_day, data.time_slot);
  if (!slotCheck.available) {
    return { error: slotCheck.reason };
  }

  const nextServiceDate = data.start_date || getNextServiceDate(data.recurring_day);

  const { error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: user.id,
      plan: data.plan,
      package: data.package_id,
      service_type: data.service_type,
      vehicle_size: data.vehicle_size,
      recurring_day: data.recurring_day,
      recurring_time: data.time_slot,
      location: data.location,
      service_address: data.address || null,
      next_service_date: nextServiceDate,
      status: "active",
    });

  if (error) {
    console.error("Subscription insert error:", error);
    return { error: "Failed to create subscription. Please try again." };
  }

  return { success: true };
}
