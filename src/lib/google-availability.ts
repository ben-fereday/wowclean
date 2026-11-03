import "server-only";
import { googleCalendarAccessToken } from "@/lib/google-calendar";
import { ALL_TIME_SLOTS, parseBookingTime } from "@/lib/booking-schedule";

export type BusyInterval = { start: string; end: string };
export const EXTERNAL_TRAVEL_BUFFER_MINUTES = 30;
function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function calgaryAppointmentStart(date: string, time: string): number {
  const minutes = parseBookingTime(time);
  if (!validDate(date) || minutes === null) throw new Error("Invalid appointment date or time.");
  // Appointments start after 8 a.m.; noon uses the same offset even on DST transition days.
  const offset = date >= "2026-11-01" ? "-06:00" : new Intl.DateTimeFormat("en-US", { timeZone: "America/Edmonton", timeZoneName: "longOffset" })
    .formatToParts(new Date(date + "T12:00:00Z")).find((part) => part.type === "timeZoneName")!.value.replace("GMT", "");
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return Date.parse(date + "T" + hour + ":" + minute + ":00" + offset);
}
export function externalBusyStarts(date: string, durationMinutes: number, intervals: BusyInterval[]): string[] {
  if (!validDate(date) || ![120,150,180,210,240].includes(durationMinutes)) throw new Error("Invalid appointment duration.");
  const ranges = intervals.map((interval) => {
    const start = Date.parse(interval.start);
    const end = Date.parse(interval.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid calendar availability response.");
    return { start: start - EXTERNAL_TRAVEL_BUFFER_MINUTES * 60000, end: end + EXTERNAL_TRAVEL_BUFFER_MINUTES * 60000 };
  });
  return ALL_TIME_SLOTS.filter((slot) => {
    const start = calgaryAppointmentStart(date, slot);
    const end = start + durationMinutes * 60000;
    return ranges.some((range) => start < range.end && end > range.start);
  });
}
export function availabilityCalendarIds(): string[] {
  const ids: unknown = JSON.parse(process.env.GOOGLE_AVAILABILITY_CALENDARS || "[]");
  if (!Array.isArray(ids) || ids.length !== 6 || ids.some((id) => typeof id !== "string" || !id) || new Set(ids).size !== 6)
    throw new Error("Availability calendars are not configured.");
  if (ids.includes(process.env.GOOGLE_CALENDAR_ID)) throw new Error("Booking calendar cannot be an external availability calendar.");
  return ids as string[];
}
export async function getExternalBusyIntervals(date: string): Promise<BusyInterval[]> {
  if (!validDate(date)) throw new Error("Invalid appointment date.");
  const ids = availabilityCalendarIds();
  const max = new Date(date + "T00:00:00Z");
  max.setUTCDate(max.getUTCDate() + 2);
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST", headers: { Authorization: "Bearer " + await googleCalendarAccessToken(), "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin: date + "T00:00:00Z", timeMax: max.toISOString(), timeZone: "America/Edmonton", items: ids.map((id) => ({ id })) }),
    cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Could not check calendar availability.");
  const data = await response.json();
  const intervals: BusyInterval[] = [];
  for (const id of ids) {
    const calendar = data.calendars?.[id];
    // Google can return HTTP 200 with individual calendar permission errors.
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy))
      throw new Error("One or more availability calendars could not be checked.");
    for (const interval of calendar.busy) {
      if (typeof interval.start !== "string" || typeof interval.end !== "string") throw new Error("Invalid busy interval.");
      intervals.push({ start: interval.start, end: interval.end });
    }
  }
  return intervals;
}
export async function getExternalUnavailableTimes(date: string, durationMinutes: number): Promise<string[]> {
  if (process.env.VERCEL_ENV !== "production") return [];
  const intervals = await getExternalBusyIntervals(date);
  return externalBusyStarts(date, durationMinutes, intervals);
}
