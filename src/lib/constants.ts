export const PRICING = {
  standard: {
    small: { interior: 150, exterior: 80, full: 260 },
    medium: { interior: 175, exterior: 100, full: 295 },
    large: { interior: 200, exterior: 125, full: 335 },
  },
  supreme: {
    small: { interior: 225, exterior: 125, full: 380 },
    medium: { interior: 260, exterior: 150, full: 435 },
    large: { interior: 295, exterior: 185, full: 495 },
  },
  exclusive: {
    small: { interior: 450, exterior: 450, full: 665 },
    medium: { interior: 500, exterior: 500, full: 745 },
    large: { interior: 550, exterior: 575, full: 845 },
  },
} as const;

export type VehicleSize = "small" | "medium" | "large";
export type ServiceType = "interior" | "exterior" | "full";
export type PackageId = "standard" | "supreme" | "exclusive";
export type SubscriptionPlan = "weekly" | "biweekly" | "monthly";
export type BookingStatus = "confirmed" | "completed" | "cancelled" | "no_show";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type LocationType = "mobile" | "shop";

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
    id: "supreme" as PackageId,
    name: "Supreme Detail",
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
      "Everything in Supreme",
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
  { id: "pet_hair", name: "Pet Hair Removal", price: 40 },
  { id: "salt", name: "Heavy Salt / Sand Cleanup", price: 40 },
  { id: "seat_shamp", name: "Seat Shampoo", price: 60 },
  { id: "carpet_shamp", name: "Carpet Shampoo", price: 80 },
  { id: "leather", name: "Leather Conditioning", price: 50 },
  { id: "engine", name: "Engine Bay Detail", price: 60 },
  { id: "headlight", name: "Headlight Restoration", price: 80 },
  { id: "clay", name: "Clay Bar Treatment", price: 100 },
  { id: "iron", name: "Iron / Fallout Decontamination", price: 75 },
  { id: "sealant", name: "Spray Sealant Upgrade", price: 50 },
  { id: "polish", name: "Stage 1 Polish", price: 200 },
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
  supreme: "Supreme Detail",
  exclusive: "Exclusive Detail",
};

export const TIME_SLOTS = [
  "8:00 AM",
  "10:00 AM",
  "12:00 PM",
  "2:00 PM",
  "4:00 PM",
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

export function getPrice(
  pkg: PackageId,
  vehicle: VehicleSize,
  service: ServiceType
): number {
  return PRICING[pkg][vehicle][service];
}

export function generateRefCode(): string {
  return (
    "WOW-" +
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  );
}
