// All business hours and booking dates use Calgary local time.
export const BOOKING_TIME_ZONE = "America/Edmonton";
// Preserve the existing two-hour reservation window.
export const BOOKING_WINDOW_MINUTES = 120;
export const SLOT_INTERVAL_MINUTES = 30;

// Calendars and manual blocks determine availability within this daily start window.
const DAILY_HOURS = { open: 8 * 60, lastStart: 20 * 60 };

export function parseBookingTime(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return (hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + minute;
}

export function formatBookingTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

export const ALL_TIME_SLOTS = Array.from(
  { length: (21 * 60 - 8 * 60) / SLOT_INTERVAL_MINUTES + 1 },
  (_, index) => formatBookingTime(8 * 60 + index * SLOT_INTERVAL_MINUTES)
);

export function getCalgaryNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    // Alberta adopted permanent UTC-06:00 on November 1, 2026.
    timeZone: now >= new Date("2026-11-01T00:00:00Z") ? "Etc/GMT+6" : BOOKING_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

export function getOperatingTimeSlots(date: string, durationMinutes = BOOKING_WINDOW_MINUTES): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  const day = new Date(date + "T12:00:00Z");
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return [];
  const hours = DAILY_HOURS;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return [];
  // The cutoff limits the start time; the full appointment may finish later.
  const latest = hours.lastStart;
  const slots: string[] = [];
  for (let minute = hours.open; minute <= latest; minute += SLOT_INTERVAL_MINUTES) {
    slots.push(formatBookingTime(minute));
  }
  return slots;
}

export function getBookableTimeSlots(date: string, now: Date = new Date(), durationMinutes = BOOKING_WINDOW_MINUTES): string[] {
  const current = getCalgaryNow(now);
  if (date < current.date) return [];
  return getOperatingTimeSlots(date, durationMinutes).filter(
    (slot) => date !== current.date || parseBookingTime(slot)! > current.minutes
  );
}

export function isScheduledBookingTime(date: string, time: string, now: Date = new Date(), durationMinutes = BOOKING_WINDOW_MINUTES): boolean {
  const minute = parseBookingTime(time);
  return minute !== null && getBookableTimeSlots(date, now, durationMinutes).includes(formatBookingTime(minute));
}

export function bookingTimesConflict(first: string, second: string): boolean {
  const a = parseBookingTime(first);
  const b = parseBookingTime(second);
  return a === null || b === null || Math.abs(a - b) < BOOKING_WINDOW_MINUTES;
}

export function getBookingDurationMinutes(packageId: string, vehicleSize: string, addons: readonly { id: string }[] = []): number {
  const extra = new Set(addons.filter((addon) => ["seat_shamp", "carpet_shamp", "salt"].includes(addon.id)).map((addon) => addon.id)).size;
  return (packageId === "premium" || vehicleSize === "large" ? 150 : 120) + extra * 30;
}
export function formatBookingDuration(minutes: number): string {
  return minutes % 60 ? `${Math.floor(minutes / 60)} hours 30 minutes` : `${minutes / 60} hours`;
}
