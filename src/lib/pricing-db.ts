"use server";

import { createClient } from "@/lib/supabase/server";
import {
  PRICING,
  ADDONS,
  SUBSCRIPTION_PRICING,
  type PackageId,
  type VehicleSize,
  type ServiceType,
  type SubscriptionPlan,
} from "@/lib/constants";

// ─── Types ───

export type BookingPricingGrid = Record<
  string,
  Record<string, Record<string, number>>
>;

export interface AddonItem {
  id: string;
  name: string;
  price: number;
  sort_order: number;
  active: boolean;
}

export type SubPricingGrid = Record<
  string,
  Record<string, Record<string, number>>
>;

export interface AllPricing {
  booking: BookingPricingGrid;
  addons: AddonItem[];
  subscription: SubPricingGrid;
}

// ─── Read functions ───

export async function fetchBookingPrices(): Promise<BookingPricingGrid> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("booking_prices")
      .select("package, vehicle_size, service_type, price");

    if (error || !data || data.length === 0) return PRICING as unknown as BookingPricingGrid;

    const grid: BookingPricingGrid = {};
    for (const row of data) {
      if (!grid[row.package]) grid[row.package] = {};
      if (!grid[row.package][row.vehicle_size])
        grid[row.package][row.vehicle_size] = {};
      grid[row.package][row.vehicle_size][row.service_type] = row.price;
    }
    return grid;
  } catch {
    return PRICING as unknown as BookingPricingGrid;
  }
}

export async function fetchAddonItems(): Promise<AddonItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("addon_items")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return ADDONS.map((a, i) => ({
        id: a.id,
        name: a.name,
        price: a.price,
        sort_order: i,
        active: true,
      }));
    }
    return data as AddonItem[];
  } catch {
    return ADDONS.map((a, i) => ({
      id: a.id,
      name: a.name,
      price: a.price,
      sort_order: i,
      active: true,
    }));
  }
}

export async function fetchSubscriptionPrices(): Promise<SubPricingGrid> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("subscription_prices")
      .select("plan, package, vehicle_size, price");

    if (error || !data || data.length === 0)
      return SUBSCRIPTION_PRICING as unknown as SubPricingGrid;

    const grid: SubPricingGrid = {};
    for (const row of data) {
      if (!grid[row.plan]) grid[row.plan] = {};
      if (!grid[row.plan][row.package]) grid[row.plan][row.package] = {};
      grid[row.plan][row.package][row.vehicle_size] = row.price;
    }
    return grid;
  } catch {
    return SUBSCRIPTION_PRICING as unknown as SubPricingGrid;
  }
}

export async function fetchAllPricing(): Promise<AllPricing> {
  const [booking, addons, subscription] = await Promise.all([
    fetchBookingPrices(),
    fetchAddonItems(),
    fetchSubscriptionPrices(),
  ]);
  return { booking, addons, subscription };
}

// ─── Write functions (admin only) ───

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "owner"].includes(profile.role)) {
    throw new Error("Unauthorized");
  }
  return supabase;
}

export async function updateBookingPrice(
  pkg: PackageId,
  vehicleSize: VehicleSize,
  serviceType: ServiceType,
  price: number
) {
  if (price < 0 || !Number.isFinite(price)) return { error: "Invalid price." };
  const supabase = await verifyAdmin();
  const { error } = await supabase
    .from("booking_prices")
    .update({ price })
    .eq("package", pkg)
    .eq("vehicle_size", vehicleSize)
    .eq("service_type", serviceType);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateAddonItem(
  id: string,
  patch: Partial<{ name: string; price: number; active: boolean; sort_order: number }>
) {
  if (patch.price !== undefined && (patch.price < 0 || !Number.isFinite(patch.price))) return { error: "Invalid price." };
  const supabase = await verifyAdmin();
  const { error } = await supabase
    .from("addon_items")
    .update(patch)
    .eq("id", id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function addAddonItem(input: {
  id: string;
  name: string;
  price: number;
}) {
  if (input.price < 0 || !Number.isFinite(input.price)) return { error: "Invalid price." };
  const supabase = await verifyAdmin();

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from("addon_items")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("addon_items").insert({
    id: input.id.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
    name: input.name,
    price: input.price,
    sort_order: sortOrder,
    active: true,
  });

  if (error) {
    if (error.code === "23505") return { error: "An add-on with that ID already exists." };
    return { error: error.message };
  }
  return { success: true };
}

export async function deleteAddonItem(id: string) {
  const supabase = await verifyAdmin();
  const { error } = await supabase.from("addon_items").delete().eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateSubscriptionPrice(
  plan: SubscriptionPlan,
  pkg: string,
  vehicleSize: VehicleSize,
  price: number
) {
  if (price < 0 || !Number.isFinite(price)) return { error: "Invalid price." };
  const supabase = await verifyAdmin();
  const { error } = await supabase
    .from("subscription_prices")
    .update({ price })
    .eq("plan", plan)
    .eq("package", pkg)
    .eq("vehicle_size", vehicleSize);

  if (error) return { error: error.message };
  return { success: true };
}
