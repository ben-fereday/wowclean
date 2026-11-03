export const PROMO_LIMITS = ["unlimited", "once_per_email", "single_use"] as const;
export type PromoUsageLimit = typeof PROMO_LIMITS[number];
export const PROMO_LIMIT_LABELS: Record<PromoUsageLimit, string> = {
  unlimited: "Unlimited",
  once_per_email: "Once per email address",
  single_use: "Single use total",
};
export function isPromoUsageLimit(value: unknown): value is PromoUsageLimit {
  return PROMO_LIMITS.some(limit => limit === value);
}
export function normalizeBookingEmail(value: string) { return value.trim().toLowerCase(); }
