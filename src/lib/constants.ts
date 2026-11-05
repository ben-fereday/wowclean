import { ALL_TIME_SLOTS } from "@/lib/booking-schedule";

export const PRICING = {
  standard: {
    small: { interior: 100, exterior: 70, full: 165 },
    medium: { interior: 130, exterior: 85, full: 195 },
    large: { interior: 150, exterior: 100, full: 225 },
  },
  premium: {
    small: { interior: 160, exterior: 110, full: 250 },
    medium: { interior: 190, exterior: 130, full: 295 },
    large: { interior: 220, exterior: 155, full: 335 },
  },
} as const;

export type VehicleSize = "small" | "medium" | "large";
export type ServiceType = "interior" | "exterior" | "full";
export type PackageId = "standard" | "premium";
export function isPackageId(value: unknown): value is PackageId {
  return value === "standard" || value === "premium";
}

export type SubscriptionPlan = "weekly" | "biweekly" | "monthly";
export type BillingCycle = "monthly" | "three_month";
export type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type LocationType = "mobile" | "shop";
export type PromoScope = "booking" | "subscription";

export const PACKAGES = [
  {
    id: "standard" as PackageId,
    name: "The Standard",
    desc: "Ideal for regular maintenance and upkeep. Keeps your car clean, protected, and road-ready.",
    features: [
      "Full interior vacuum",
      "Surface cleaning",
      "Interior & exterior glass",
      "Tire dressing",
      "Paint sealant",
    ],
    interiorFeatures: [
      "Full interior vacuum",
      "Cleaning of dash, console, door panels and accessible surfaces",
      "Interior glass cleaned",
      "Light dust & debris removal",
    ],
    exteriorFeatures: [
      "Hand wash and dry",
      "Wheels cleaned",
      "Tire dressing",
      "Exterior glass cleaned",
      "Paint sealant for shine & short-term protection",
    ],
    shopOnly: false,
  },
  {
    id: "premium" as PackageId,
    name: "Premium Detail",
    desc: "Thorough interior cleaning with extra attention to surfaces, crevices, cupholders and vents.",
    features: [
      "Everything in Standard",
      "Thorough surface cleaning",
      "Leather conditioning",
      "Decontamination",
      "Engine bay clean",
    ],
    interiorFeatures: [
      "Thorough interior surface cleaning, including detailed attention to crevices, cupholders and vents",
      "Leather cleaning & conditioning",
    ],
    exteriorFeatures: [
      "Chemical & physical decontamination treatment",
      "Engine bay clean and dressing",
      "Enhanced finish and protection",
    ],
    shopOnly: false,
  },
] as const;

export const ADDONS = [
  { id: "pet_hair", name: "Pet Hair Removal", price: 30 },
  { id: "salt", name: "Heavy Salt / Sand Cleanup", price: 30 },
  { id: "seat_shamp", name: "Seat Shampoo", price: 40 },
  { id: "carpet_shamp", name: "Carpet Shampoo", price: 60 },
  { id: "leather", name: "Leather Conditioning", price: 40 },
  { id: "engine", name: "Engine Bay Detail", price: 40 },
  { id: "clay", name: "Clay Bar Treatment", price: 75 },
  { id: "iron", name: "Iron / Fallout Decontamination", price: 50 },
  { id: "sealant", name: "Protective Sealant", price: 40 },
] as const;

export const VEHICLE_LABELS: Record<VehicleSize, string> = {
  small: "Small Vehicle",
  medium: "Medium Vehicle",
  large: "Large Vehicle",
};

export const VEHICLE_EXAMPLES: Record<VehicleSize, string> = {
  small: "Coupe, Sedan, Hatchback",
  medium: "Crossover, Small SUV, Wagon",
  large: "Full-Size SUV, Truck, Minivan",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  interior: "Interior Only",
  exterior: "Exterior Only",
  full: "Full Detail",
};

export const PACKAGE_LABELS: Record<PackageId, string> = {
  standard: "The Standard",
  premium: "Premium Detail",
};

export const TIME_SLOTS = ALL_TIME_SLOTS;

export const BILLING_CYCLES: {
  id: BillingCycle;
  name: string;
  desc: string;
  discountPct: number;
}[] = [
  {
    id: "monthly",
    name: "Pay Monthly",
    desc: "Billed each month for that month's visits.",
    discountPct: 0,
  },
  {
    id: "three_month",
    name: "Pay Every 3 Months",
    desc: "Prepay 3 months upfront and save 10%.",
    discountPct: 10,
  },
];

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const SUBSCRIPTION_PLANS: {
  id: SubscriptionPlan;
  name: string;
  desc: string;
  discount: string;
}[] = [
  {
    id: "weekly",
    name: "Weekly",
    desc: "Service every week on your chosen day",
    discount: "Best value",
  },
  {
    id: "biweekly",
    name: "Bi-Weekly",
    desc: "Service every two weeks on your chosen day",
    discount: "Popular",
  },
  {
    id: "monthly",
    name: "Monthly",
    desc: "Service once a month on your chosen day",
    discount: "Great start",
  },
];

export const SUBSCRIPTION_PRICING: Record<
  SubscriptionPlan,
  Record<string, Record<VehicleSize, number>>
> = {
  weekly: {
    standard: { small: 130, medium: 155, large: 180 },
  },
  biweekly: {
    standard: { small: 145, medium: 170, large: 195 },
  },
  monthly: {
    standard: { small: 155, medium: 185, large: 215 },
    premium: { small: 200, medium: 245, large: 295 },
  },
};

export function getPrice(
  pkg: PackageId,
  vehicle: VehicleSize,
  service: ServiceType
): number {
  return PRICING[pkg][vehicle][service];
}

/** Per-visit price for a subscription. */
export function getSubscriptionPrice(
  plan: SubscriptionPlan,
  vehicle: VehicleSize,
  pkg: PackageId
): number {
  const planPricing = SUBSCRIPTION_PRICING[plan];
  const pkgPricing = planPricing[pkg];
  if (!pkgPricing) return 0;
  return pkgPricing[vehicle];
}

/** Monthly billing total for a subscription (per-visit × visits/month). */
export function getSubscriptionMonthlyTotal(
  plan: SubscriptionPlan,
  vehicle: VehicleSize,
  pkg: PackageId
): number {
  const perVisit = getSubscriptionPrice(plan, vehicle, pkg);
  const multiplier = plan === "weekly" ? 4 : plan === "biweekly" ? 2 : 1;
  return perVisit * multiplier;
}

export function applyDiscount(
  basePrice: number,
  discountPct: number | null | undefined
): number {
  if (!discountPct || discountPct <= 0) return basePrice;
  return Math.round(basePrice * (1 - discountPct / 100));
}

export function generateRefCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "WOW-";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return code;
}
