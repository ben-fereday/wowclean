"use server";

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
  time: string
): Promise<{ available: boolean; reason?: string }> {
  if (!isScheduledBookingTime(date, time)) return { available: false, reason: "Please choose an available appointment time within our Calgary business hours." };
  try {
    const unavailable = await getBookedTimesForDate(date);
    return unavailable.includes(formatBookingTime(parseBookingTime(time)!))
      ? { available: false, reason: "This time overlaps an existing appointment or blocked time." }
      : { available: true };
  } catch {
    return { available: false, reason: "Availability could not be confirmed. Please try again." };
  }
}

/** Returns unavailable appointment STARTS, already accounting for the two-hour window. */
export async function getBookedTimesForDate(date: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("booking_busy_times", { p_date: date });
  if (error) throw new Error("Availability could not be confirmed.");
  return data ?? [];
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
