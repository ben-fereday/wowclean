"use server";

import { createClient } from "@/lib/supabase/server";
import { BOOKING_WINDOW_MINUTES, bookingTimesConflict, getOperatingTimeSlots, isScheduledBookingTime } from "@/lib/booking-schedule";

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
  if (!isScheduledBookingTime(date, time)) {
    return { available: false, reason: "Please choose an available appointment time within our Calgary business hours." };
  }
  const supabase = await createClient();

  // Check blocked slots (whole day or specific time)
  const { data: blocked, error: blockedError } = await supabase
    .from("blocked_slots")
    .select("blocked_time, reason")
    .eq("blocked_date", date);

  if (blockedError) {
    return { available: false, reason: "Availability could not be confirmed. Please try again or contact WOW CLEAN." };
  }

  if (blocked) {
    for (const b of blocked) {
      if (!b.blocked_time) {
        return { available: false, reason: b.reason || "This day is blocked off." };
      }
      if (hoursConflict(b.blocked_time, time)) {
        return { available: false, reason: b.reason || `${b.blocked_time} is blocked off.` };
      }
    }
  }

  // Check one-time bookings on this date
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("booking_time")
    .eq("booking_date", date)
    .in("status", ["confirmed"]);

  if (bookingsError) {
    return { available: false, reason: "Availability could not be confirmed. Please try again or contact WOW CLEAN." };
  }

  if (bookings) {
    for (const b of bookings) {
      if (hoursConflict(b.booking_time, time)) {
        return {
          available: false,
          reason: `Too close to an existing booking at ${b.booking_time}. Appointments need a ${BUFFER_HOURS}-hour gap.`,
        };
      }
    }
  }

  // Check recurring subscriptions that actually fall on this specific date
  const checkDate = new Date(date + "T12:00:00");
  const dayOfWeek = checkDate.toLocaleDateString("en-US", { weekday: "long" });

  const { data: subs, error: subsError } = await supabase
    .from("subscriptions")
    .select("recurring_time, plan, next_service_date")
    .eq("recurring_day", dayOfWeek)
    .eq("status", "active");

  if (subsError) {
    return { available: false, reason: "Availability could not be confirmed. Please try again or contact WOW CLEAN." };
  }

  if (subs) {
    for (const s of subs) {
      if (!s.next_service_date) continue;
      const startDate = new Date(s.next_service_date + "T12:00:00");
      const diffDays = Math.round((checkDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const interval = s.plan === "weekly" ? 7 : s.plan === "biweekly" ? 14 : 28;
      if (diffDays % interval === 0 && hoursConflict(s.recurring_time, time)) {
        return {
          available: false,
          reason: `Too close to a recurring subscription at ${s.recurring_time}. Appointments need a ${BUFFER_HOURS}-hour gap.`,
        };
      }
    }
  }

  return { available: true };
}

/**
 * Get all booked/unavailable times for a specific date.
 * Includes bookings, subscriptions, AND blocked slots.
 */
export async function getBookedTimesForDate(
  date: string
): Promise<string[]> {
  const supabase = await createClient();
  const bookedTimes: string[] = [];

  // Check blocked slots
  const { data: blocked, error: blockedError } = await supabase
    .from("blocked_slots")
    .select("blocked_time")
    .eq("blocked_date", date);

  if (blockedError) {
    throw new Error("Availability could not be confirmed.");
  }

  if (blocked) {
    for (const b of blocked) {
      if (!b.blocked_time) {
        // Whole day blocked — return all possible times
        return getOperatingTimeSlots(date);
      }
      bookedTimes.push(b.blocked_time);
    }
  }

  // Get bookings on this date
  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("booking_time")
    .eq("booking_date", date)
    .in("status", ["confirmed"]);

  if (bookingsError) {
    throw new Error("Availability could not be confirmed.");
  }

  if (bookings) {
    for (const b of bookings) bookedTimes.push(b.booking_time);
  }

  // Get subscriptions recurring on this day-of-week, respecting plan frequency
  const checkDate = new Date(date + "T12:00:00");
  const dayOfWeek = checkDate.toLocaleDateString("en-US", { weekday: "long" });
  const { data: subs, error: subsError } = await supabase
    .from("subscriptions")
    .select("recurring_time, plan, next_service_date")
    .eq("recurring_day", dayOfWeek)
    .eq("status", "active");

  if (subsError) {
    throw new Error("Availability could not be confirmed.");
  }

  if (subs) {
    for (const s of subs) {
      if (!s.next_service_date) continue;
      const startDate = new Date(s.next_service_date + "T12:00:00");
      const diffDays = Math.round((checkDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const interval = s.plan === "weekly" ? 7 : s.plan === "biweekly" ? 14 : 28;
      if (diffDays % interval === 0) {
        bookedTimes.push(s.recurring_time);
      }
    }
  }

  return bookedTimes;
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

  return bookedTimes;
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
