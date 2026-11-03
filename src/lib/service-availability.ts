import type { ServiceType } from "@/lib/constants";

// Set to true to reopen exterior and full-detail bookings for the season.
export const EXTERIOR_BOOKINGS_ENABLED: boolean = false;

// Set to true to restore recurring plans and signup links.
export const SUBSCRIPTIONS_ENABLED: boolean = false;

export const SEASONAL_EXTERIOR_MESSAGE =
  "Exterior and full detailing are available in spring and summer, weather permitting. Bookings are currently closed. Customer-provided water and power are required.";

export const INTERIOR_REQUIREMENTS =
  "Customer-provided power is required. Winter appointments require a suitable heated indoor workspace where detailing is permitted.";

const EXTERIOR_ADDON_IDS = new Set(["engine", "clay", "iron", "sealant"]);

export function isServiceBookable(service: string): service is ServiceType {
  return service === "interior" ||
    (EXTERIOR_BOOKINGS_ENABLED && (service === "exterior" || service === "full"));
}

export function isAddonBookable(id: string): boolean {
  return id !== "polish" &&
    (EXTERIOR_BOOKINGS_ENABLED || !EXTERIOR_ADDON_IDS.has(id));
}
