import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const signature = (payload: string, secret: string) => createHmac("sha256", secret).update("wowclean:manage-booking:v1:" + payload).digest("base64url");
function signingKey() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Booking access is unavailable.");
  return key;
}

export function createBookingAccessToken(id: string, date: string, secret = signingKey(), now = Date.now()) {
  if (!UUID.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid booking.");
  // End of the appointment's Calgary day, plus 30 days. At least 30 days for an older booking.
  const expiry = Math.max(now, Date.parse(date + "T23:59:59-06:00")) + 30 * 86400000;
  if (!Number.isFinite(expiry)) throw new Error("Invalid booking date.");
  const payload = Buffer.from(JSON.stringify({ v: 1, id, exp: Math.floor(expiry / 1000) })).toString("base64url");
  return payload + "." + signature(payload, secret);
}

export function verifyBookingAccessToken(token: string, secret = signingKey(), now = Date.now()): string | null {
  if (typeof token !== "string" || token.length > 400 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [payload, supplied] = token.split(".");
  const expected = signature(payload, secret);
  if (!timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.v === 1 && UUID.test(data.id) && Number.isSafeInteger(data.exp) && data.exp > Math.floor(now / 1000) ? data.id as string : null;
  } catch { return null; }
}

export function bookingManageUrl(id: string, date: string) {
  // Fragment keeps the access token out of server request URLs and referrer headers.
  return "https://wowcleancalgary.com/manage-booking#token=" + createBookingAccessToken(id, date);
}

export async function readManagedBooking(token: string) {
  const id = verifyBookingAccessToken(token);
  if (!id) return null;
  const columns = "id,reference_code,guest_first_name,guest_email,booking_date,booking_time,status,package,service_type,vehicle_size,vehicle_make,vehicle_model,vehicle_colour,service_address,guest_address,total_estimate,addons";
  const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL! + "/rest/v1/bookings?id=eq." + id + "&select=" + columns, {
    headers: { apikey: signingKey() }, cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Could not load your booking.");
  const rows = await response.json();
  return rows[0] as {
    id: string; reference_code: string; guest_first_name: string | null; guest_email: string | null;
    booking_date: string; booking_time: string; status: string; package: string; service_type: string;
    vehicle_size: string; vehicle_make: string | null; vehicle_model: string | null; vehicle_colour: string | null;
    service_address: string | null; guest_address: string | null; total_estimate: number;
    addons: { name: string; price: number }[] | null;
  } | undefined;
}
