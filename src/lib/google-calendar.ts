import "server-only";
import { createSign } from "node:crypto";
import { getBookingDurationMinutes, parseBookingTime } from "@/lib/booking-schedule";
import { PACKAGE_LABELS, SERVICE_TYPE_LABELS, VEHICLE_LABELS, type PackageId, type ServiceType, type VehicleSize } from "@/lib/constants";

export interface CalendarBooking {
  id: string; reference_code: string; booking_date: string; booking_time: string;
  package: string; vehicle_size: string; service_type: string; status: string;
  addons: { id: string; name?: string }[] | null;
  guest_first_name?: string | null; guest_last_name?: string | null;
  guest_phone?: string | null; guest_email?: string | null;
  service_address?: string | null; guest_address?: string | null;
  vehicle_make?: string | null; vehicle_model?: string | null; vehicle_colour?: string | null;
}
const TOKEN_URL = "https://oauth2.googleapis.com/token";
let cachedToken: { value: string; expires: number } | undefined;
function configured() {
  return process.env.VERCEL_ENV === "production" && !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !!process.env.GOOGLE_CALENDAR_ID;
}
async function token() {
  if (cachedToken && cachedToken.expires > Date.now() + 60000) return cachedToken.value;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  if (credentials.type !== "service_account" || typeof credentials.client_email !== "string" || typeof credentials.private_key !== "string") throw new Error("Invalid calendar credentials");
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: credentials.client_email, scope: "https://www.googleapis.com/auth/calendar.events", aud: TOKEN_URL, iat: now, exp: now + 3600 })).toString("base64url");
  const unsigned = header + "." + claims;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(credentials.private_key, "base64url");
  const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + signature }), signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!response.ok) throw new Error("Google authorization failed (" + response.status + ")");
  const result = await response.json();
  if (typeof result.access_token !== "string") throw new Error("Google authorization returned no token");
  cachedToken = { value: result.access_token, expires: Date.now() + Number(result.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}
export function calendarEventId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid booking ID");
  return "bc" + id.replaceAll("-", "").toLowerCase();
}
const escape = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export function bookingCalendarEvent(booking: CalendarBooking) {
  const minutes = parseBookingTime(booking.booking_time);
  if (minutes === null || !/^\d{4}-\d{2}-\d{2}$/.test(booking.booking_date)) throw new Error("Invalid appointment time");
  const wall = new Date(booking.booking_date + "T00:00:00Z");
  wall.setUTCMinutes(minutes);
  const start = wall.toISOString().slice(0, 19);
  wall.setUTCMinutes(wall.getUTCMinutes() + getBookingDurationMinutes(booking.package, booking.vehicle_size, booking.addons ?? []));
  const end = wall.toISOString().slice(0, 19);
  const name = [booking.guest_first_name, booking.guest_last_name].filter(Boolean).join(" ") || "Customer";
  const pkg = PACKAGE_LABELS[booking.package as PackageId] || booking.package;
  const vehicle = [booking.vehicle_make, booking.vehicle_model, booking.vehicle_colour].filter(Boolean).join(" ");
  return {
    id: calendarEventId(booking.id),
    summary: "WOW CLEAN — " + name + " — " + pkg,
    location: booking.service_address || booking.guest_address || "",
    description: [
      "Booking: " + booking.reference_code,
      "Service: " + (SERVICE_TYPE_LABELS[booking.service_type as ServiceType] || booking.service_type),
      "Package: " + pkg,
      "Vehicle: " + (VEHICLE_LABELS[booking.vehicle_size as VehicleSize] || booking.vehicle_size) + (vehicle ? " — " + vehicle : ""),
      "Add-ons: " + ((booking.addons ?? []).map((addon) => addon.name || addon.id).join(", ") || "None"),
      "Phone: " + (booking.guest_phone || ""),
      "Email: " + (booking.guest_email || ""),
      "Manage this booking at https://wowcleancalgary.com/admin",
      "Make booking changes on the website to keep availability correct.",
    ].map(escape).join("\n"),
    start: { dateTime: start, timeZone: "America/Edmonton" },
    end: { dateTime: end, timeZone: "America/Edmonton" },
    visibility: "private",
    transparency: "opaque",
    status: "confirmed",
    extendedProperties: { private: { wowcleanBookingId: booking.id } },
  };
}
async function request(path: string, method: string, body?: unknown) {
  return fetch("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!) + "/events" + path + "?sendUpdates=none", {
    method, headers: { Authorization: "Bearer " + await token(), "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(10000),
  });
}
export async function syncBookingCalendar(booking: CalendarBooking): Promise<{ success: boolean; error?: string }> {
  if (!configured()) return { success: false, error: "Calendar sync is not configured for this environment." };
  try {
    const id = calendarEventId(booking.id);
    for (let attempt = 0; attempt < 2; attempt++) {
      let response: Response;
      if (booking.status === "cancelled") {
        response = await request("/" + id, "DELETE");
        if (response.ok || response.status === 404 || response.status === 410) return { success: true };
      } else {
        const event = bookingCalendarEvent(booking);
        response = await request("", "POST", event);
        if (response.status === 409) {
          const { id: _id, ...patch } = event;
          response = await request("/" + id, "PATCH", patch);
        }
        if (response.ok) return { success: true };
      }
      if (response.status === 401) cachedToken = undefined;
      if (attempt === 0 && (response.status === 401 || response.status === 429 || response.status >= 500)) continue;
      throw new Error("Calendar request failed (" + response.status + ")");
    }
  } catch (error) {
    // Do not log response bodies, customer data, credentials, or tokens.
    console.error("Calendar sync failed:", error instanceof Error ? error.message : "Unknown error");
  }
  return { success: false, error: "Google Calendar could not be updated. The booking is saved; use Sync to Google Calendar in the admin panel to retry." };
}

export async function checkCalendarConnection() {
  if (!configured()) return { success: false, error: "Calendar configuration is incomplete." };
  try {
    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!) + "/events?maxResults=1&fields=kind", {
      headers: { Authorization: "Bearer " + await token() }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    return response.ok ? { success: true } : { success: false, error: "Calendar access failed (" + response.status + ")." };
  } catch { return { success: false, error: "Calendar authorization failed." }; }
}
