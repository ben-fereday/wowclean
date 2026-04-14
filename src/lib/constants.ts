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
  exclusive: {
    small: { interior: 300, exterior: 325, full: 525 },
    medium: { interior: 350, exterior: 375, full: 595 },
    large: { interior: 400, exterior: 425, full: 675 },
  },
} as const;

export type VehicleSize = "small" | "medium" | "large";
export type ServiceType = "interior" | "exterior" | "full";
export type PackageId = "standard" | "premium" | "exclusive";
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
      "Surface wipe-down",
      "Interior & exterior glass",
      "Tire dressing",
      "Paint sealant",
    ],
    interiorFeatures: [
      "Full interior vacuum",
      "Wipe down of dash, console, door panels & surfaces",
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
    desc: "More thorough inside and out. Perfect for seasonal cleanups or vehicles needing more attention.",
    features: [
      "Everything in Standard",
      "Deep surface wipe",
      "Leather conditioning",
      "Decontamination",
      "Engine bay clean",
    ],
    interiorFeatures: [
      "Deep wipe down of all interior surfaces",
      "Leather cleaning & conditioning",
      "Extra attention to cracks, crevices, cupholders, vents",
    ],
    exteriorFeatures: [
      "Chemical & physical decontamination treatment",
      "Engine bay clean and dressing",
      "Enhanced finish and protection",
    ],
    shopOnly: false,
  },
  {
    id: "exclusive" as PackageId,
    name: "Exclusive Detail",
    desc: "Our top-tier cosmetic reset. Machine polish, shampoo, and premium finishing. In-shop only.",
    features: [
      "Everything in Premium",
      "Carpet shampoo",
      "Stage 1 machine polish",
      "Deep restoration",
    ],
    interiorFeatures: [
      "Carpet & floor mat shampoo or steam treatment",
      "Deep interior restoration treatment",
      "More intensive stain & grime removal",
    ],
    exteriorFeatures: [
      "Stage 1 machine polish",
      "Gloss enhancement for improved depth & clarity",
      "Premium finishing treatment",
    ],
    shopOnly: true,
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
  { id: "polish", name: "Stage 1 Polish", price: 180 },
] as const;

export const EXCLUSIVE_INCLUDED = [
  "carpet_shamp",
  "leather",
  "engine",
  "clay",
  "iron",
  "polish",
];

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
  exclusive: "Exclusive Detail",
};

export const TIME_SLOTS = [
  "8:00 AM",
  "10:00 AM",
  "12:00 PM",
  "2:00 PM",
  "4:00 PM",
  "6:00 PM",
];

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
