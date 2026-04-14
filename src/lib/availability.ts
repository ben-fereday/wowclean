"use server";

import { createClient } from "@/lib/supabase/server";

const BUFFER_HOURS = 2;

function parseTimeToHour(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return -1;
  let hour = parseInt(match[1]);
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return hour;
}

function hoursConflict(existingTime: string, requestedTime: string): boolean {
  const a = parseTimeToHour(existingTime);
  const b = parseTimeToHour(requestedTime);
  if (a === -1 || b === -1) return false;
  return Math.abs(a - b) < BUFFER_HOURS;
}

/**
 * Check if a specific date+time slot is available.
 * Checks bookings, subscriptions, AND blocked slots.
 */
export async function checkTimeSlotAvailable(
  date: string,
  time: string
): Promise<{ available: boolean; reason?: string }> {
  const supabase = await createClient();

  // Check blocked slots (whole day or specific time)
  const { data: blocked } = await supabase
    .from("blocked_slots")
    .select("blocked_time, reason")
    .eq("blocked_date", date);

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
  const { data: bookings } = await supabase
    .from("bookings")
    .select("booking_time")
    .eq("booking_date", date)
    .in("status", ["confirmed"]);

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

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("recurring_time, plan, next_service_date")
    .eq("recurring_day", dayOfWeek)
    .eq("status", "active");

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
  const { data: blocked } = await supabase
    .from("blocked_slots")
    .select("blocked_time")
    .eq("blocked_date", date);

  if (blocked) {
    for (const b of blocked) {
      if (!b.blocked_time) {
        // Whole day blocked — return all possible times
        return ["8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM"];
      }
      bookedTimes.push(b.blocked_time);
    }
  }

  // Get bookings on this date
  const { data: bookings } = await supabase
    .from("bookings")
    .select("booking_time")
    .eq("booking_date", date)
    .in("status", ["confirmed"]);

  if (bookings) {
    for (const b of bookings) bookedTimes.push(b.booking_time);
  }

  // Get subscriptions recurring on this day-of-week, respecting plan frequency
  const checkDate = new Date(date + "T12:00:00");
  const dayOfWeek = checkDate.toLocaleDateString("en-US", { weekday: "long" });
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("recurring_time, plan, next_service_date")
    .eq("recurring_day", dayOfWeek)
    .eq("status", "active");

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
