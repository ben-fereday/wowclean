import type { AddonItem, AllPricing } from "./pricing-db";
import type { PackageId, VehicleSize, ServiceType, SubscriptionPlan } from "./constants";

export const PRICING_PACKAGES = ["standard", "premium"] as const;
export const PRICING_SIZES = ["small", "medium", "large"] as const;
export const PRICING_SERVICES = ["interior", "exterior", "full"] as const;
export const PRICING_SUBSCRIPTIONS = [
  { plan: "weekly", pkg: "standard" },
  { plan: "biweekly", pkg: "standard" },
  { plan: "monthly", pkg: "standard" },
  { plan: "monthly", pkg: "premium" },
] as const;

type TextGrid = Record<string, Record<string, Record<string, string>>>;
export type PricingDraft = {
  booking: TextGrid;
  subscription: TextGrid;
  addons: (Omit<AddonItem, "price"> & { price: string; deleted?: boolean })[];
};
export type PricingChange =
  | { kind: "booking"; key: string; pkg: PackageId; size: VehicleSize; service: ServiceType; price: number; before: number }
  | { kind: "subscription"; key: string; plan: SubscriptionPlan; pkg: PackageId; size: VehicleSize; price: number; before: number }
  | { kind: "addon-update"; key: string; id: string; name: string; price: number; active: boolean; before: AddonItem }
  | { kind: "addon-create"; key: string; id: string; name: string; price: number }
  | { kind: "addon-delete"; key: string; id: string; name: string };

export function pricingDraft(data: AllPricing): PricingDraft {
  const text = (grid: AllPricing["booking"]): TextGrid => Object.fromEntries(
    Object.entries(grid).map(([a, rows]) => [a, Object.fromEntries(
      Object.entries(rows).map(([b, values]) => [b, Object.fromEntries(
        Object.entries(values).map(([c, value]) => [c, String(value)])
      )])
    )])
  );
  return { booking: text(data.booking), subscription: text(data.subscription), addons: data.addons.map(a => ({ ...a, price: String(a.price) })) };
}

// Match Calgary's existing name-to-ID conversion; do not import Vancouver IDs.
export function addonId(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export function pricingChanges(baseline: AllPricing, draft: PricingDraft) {
  const changes: PricingChange[] = [];
  const errors: string[] = [];
  function price(raw: string | undefined, label: string) {
    const value = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
    // Calgary pricing columns store whole dollars (integer), not decimal CAD.
    if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) {
      errors.push(`${label}: enter a whole-dollar price of $0 or more.`);
      return null;
    }
    return value;
  }
  for (const pkg of PRICING_PACKAGES) for (const size of PRICING_SIZES) for (const service of PRICING_SERVICES) {
    const before = baseline.booking[pkg]?.[size]?.[service];
    if (before === undefined) { errors.push(`Missing ${pkg} ${size} ${service} price. Reload before saving.`); continue; }
    const value = price(draft.booking[pkg]?.[size]?.[service], `${pkg} ${size} ${service}`);
    if (value !== null && value !== before) changes.push({ kind: "booking", key: `booking-${pkg}-${size}-${service}`, pkg, size, service, price: value, before });
  }
  for (const { plan, pkg } of PRICING_SUBSCRIPTIONS) for (const size of PRICING_SIZES) {
    const before = baseline.subscription[plan]?.[pkg]?.[size];
    if (before === undefined) { errors.push(`Missing ${plan} ${pkg} ${size} price. Reload before saving.`); continue; }
    const value = price(draft.subscription[plan]?.[pkg]?.[size], `${plan} ${pkg} ${size}`);
    if (value !== null && value !== before) changes.push({ kind: "subscription", key: `sub-${plan}-${pkg}-${size}`, plan, pkg, size, price: value, before });
  }
  const ids = new Set<string>();
  for (const addon of draft.addons) {
    if (ids.has(addon.id)) { errors.push(`Duplicate add-on ID: ${addon.id}.`); continue; }
    ids.add(addon.id);
    const before = baseline.addons.find(a => a.id === addon.id);
    if (addon.deleted) {
      if (before) changes.push({ kind: "addon-delete", key: `delete-${addon.id}`, id: addon.id, name: addon.name });
      continue;
    }
    const value = price(addon.price, addon.name);
    if (value === null) continue;
    if (!before) {
      if (!addon.name.trim() || !addon.id) { errors.push("Enter an add-on name containing letters or numbers."); continue; }
      changes.push({ kind: "addon-create", key: `create-${addon.id}`, id: addon.id, name: addon.name, price: value });
    } else if (value !== before.price || addon.active !== before.active) {
      changes.push({ kind: "addon-update", key: `addon-${addon.id}`, id: addon.id, name: addon.name, price: value, active: addon.active, before });
    }
  }
  return { changes, errors };
}

export interface PricingActions {
  updateBookingPrice: (pkg: PackageId, size: VehicleSize, service: ServiceType, price: number) => Promise<{ error?: string }>;
  updateSubscriptionPrice: (plan: SubscriptionPlan, pkg: string, size: VehicleSize, price: number) => Promise<{ error?: string }>;
  updateAddonItem: (id: string, patch: { price?: number; active?: boolean }) => Promise<{ error?: string }>;
  addAddonItem: (input: { id: string; name: string; price: number }) => Promise<{ error?: string }>;
  deleteAddonItem: (id: string) => Promise<{ error?: string }>;
}

export async function savePricingChanges(changes: PricingChange[], actions: PricingActions) {
  const saved: PricingChange[] = [];
  const failed: { change: PricingChange; error: string }[] = [];
  for (const change of changes) {
    try {
      let result: { error?: string };
      switch (change.kind) {
        case "booking": result = await actions.updateBookingPrice(change.pkg, change.size, change.service, change.price); break;
        case "subscription": result = await actions.updateSubscriptionPrice(change.plan, change.pkg, change.size, change.price); break;
        case "addon-update": {
          const patch: { price?: number; active?: boolean } = {};
          if (change.price !== change.before.price) patch.price = change.price;
          if (change.active !== change.before.active) patch.active = change.active;
          result = await actions.updateAddonItem(change.id, patch); break;
        }
        case "addon-create": result = await actions.addAddonItem({ id: change.id, name: change.name, price: change.price }); break;
        case "addon-delete": result = await actions.deleteAddonItem(change.id); break;
      }
      if (result.error) failed.push({ change, error: result.error });
      else saved.push(change);
    } catch (error) {
      failed.push({ change, error: error instanceof Error ? error.message : "Could not save. Please retry." });
    }
  }
  return { saved, failed };
}

// Advance only successful changes. Retrying never recreates an already saved add-on.
export function savedPricingBaseline(data: AllPricing, changes: PricingChange[]): AllPricing {
  const next = structuredClone(data);
  for (const change of changes) {
    switch (change.kind) {
      case "booking": next.booking[change.pkg][change.size][change.service] = change.price; break;
      case "subscription": next.subscription[change.plan][change.pkg][change.size] = change.price; break;
      case "addon-delete": next.addons = next.addons.filter(a => a.id !== change.id); break;
      case "addon-update": next.addons = next.addons.map(a => a.id === change.id ? { ...a, price: change.price, active: change.active } : a); break;
      case "addon-create": next.addons.push({ id: change.id, name: change.name, price: change.price, active: true, sort_order: Math.max(-1, ...next.addons.map(a => a.sort_order)) + 1 }); break;
    }
  }
  return next;
}
