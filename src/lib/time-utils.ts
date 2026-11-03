import { formatBookingTime, parseBookingTime } from "@/lib/booking-schedule";

/** bookedTimes contains unavailable starts, with overlap already calculated server-side. */
export function isTimeBlocked(time: string, bookedTimes: string[]): boolean {
  const minute = parseBookingTime(time);
  return minute === null || bookedTimes.includes(formatBookingTime(minute));
}
