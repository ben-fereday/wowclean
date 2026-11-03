"use server";

import { getExternalUnavailableTimes } from "@/lib/google-availability";
import { createClient } from "@/lib/supabase/server";
import { ALL_TIME_SLOTS, BOOKING_WINDOW_MINUTES, bookingTimesConflict, formatBookingTime, parseBookingTime, isScheduledBookingTime } from "@/lib/booking-schedule";

const BUFFER_HOURS = BOOKING_WINDOW_MINUTES / 60;
const hoursConflict = bookingTimesConflict;

/**
 * Check if a specific date+time slot is available.
 * Checks bookings, subscriptions, AND blocked slots.
 */
export async function checkTimeSlotAvailable(
  date: string,
  time: string,
  durationMinutes = BOOKING_WINDOW_MINUTES
): Promise<{ available: boolean; reason?: string }> {
  if (!isScheduledBookingTime(date, time, new Date(), durationMinutes)) return { available: false, reason: "Please choose an available appointment time within our Calgary business hours." };
  try {
    const unavailable = await getBookedTimesForDate(date, durationMinutes);
    return unavailable.includes(formatBookingTime(parseBookingTime(time)!))
      ? { available: false, reason: "This appointment time is no longer available. Please choose another time." }
      : { available: true };
  } catch {
    return { available: false, reason: "Availability could not be confirmed. Please try again." };
  }
}

/** Returns unavailable appointment STARTS, already accounting for the two-hour window. */
export async function getBookedTimesForDate(date: string, durationMinutes = BOOKING_WINDOW_MINUTES): Promise<string[]> {
  const supabase = await createClient();
  const [bookingResult, externalTimes] = await Promise.all([
    supabase.rpc("booking_busy_times_for_duration", { p_date: date, p_duration: durationMinutes }),
    getExternalUnavailableTimes(date, durationMinutes),
  ]);
  if (bookingResult.error) throw new Error("Availability could not be confirmed.");
  return [...new Set<string>([...(bookingResult.data ?? []), ...externalTimes])];
}

/**
 * Get all booked/unavailable times for a day-of-week (for subscriptions).
 */
export async function getBookedTimesForDay(
  day: string
): Promise<string[]> {
  const supabase = await createClient();
  const bookedTimes: string[] = [];

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("recurring_time")
    .eq("recurring_day", day)
    .eq("status", "active");

  if (subs) {
    for (const s of subs) bookedTimes.push(s.recurring_time);
  }

  return ALL_TIME_SLOTS.filter((slot) => bookedTimes.some((time) => bookingTimesConflict(slot, time)));
}

export async function checkSubscriptionSlotAvailable(
  day: string,
  time: string
): Promise<{ available: boolean; reason?: string }> {
  const supabase = await createClient();

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("recurring_time")
    .eq("recurring_day", day)
    .eq("status", "active");

  if (subs) {
    for (const s of subs) {
      if (hoursConflict(s.recurring_time, time)) {
        return {
          available: false,
          reason: `Too close to an existing subscription at ${s.recurring_time} on ${day}s. Appointments need a ${BUFFER_HOURS}-hour gap.`,
        };
      }
    }
  }

  return { available: true };
}

/**
 * Check whether a subscription's proposed start date+time conflicts with
 * any existing one-time booking, blocked slot, or other recurring subscription
 * occurrence on that exact date. Used at subscription creation time.
 */
export async function checkSubscriptionStartConflict(
  startDate: string,
  time: string
): Promise<{ available: boolean; reason?: string }> {
  return checkTimeSlotAvailable(startDate, time);
}
