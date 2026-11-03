import { parseBookingTime } from "./booking-schedule";
import type { BookingStatus, PackageId, ServiceType, VehicleSize } from "@/lib/constants";

export interface BookingAddon {
  id: string;
  name: string;
  price: number;
}

export interface Booking {
  id: string;
  archived_at?: string | null;
  user_id: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_address: string | null;
  service_address: string | null;
  booking_date: string;
  booking_time: string;
  package: PackageId;
  service_type: ServiceType;
  vehicle_size: VehicleSize;
  location: string;
  status: BookingStatus;
  reference_code: string;
  total_estimate: number;
  addons: BookingAddon[];
  notes: string | null;
  promo_code: string | null;
  promo_discount_pct: number | null;
  profiles?: { first_name: string; last_name: string; phone: string } | null;
}



export type HistoryPayment = { booking_id: string; payment_status: string; final_amount: number | null };
export const historyName = (b: Booking) => b.profiles ? `${b.profiles.first_name} ${b.profiles.last_name}`.trim() : `${b.guest_first_name ?? ""} ${b.guest_last_name ?? ""}`.trim() || "Guest";

export function filterAppointmentHistory(bookings: Booking[], paymentMap: Map<string, HistoryPayment>, filters: { search: string; range: string; from: string; to: string; status: string; payment: string; showArchived?: boolean }, now: {date: string; minutes: number}) {
  const {search, range, from, to, status, payment} = filters;
  const invalidRange = range === "custom" && !!from && !!to && from > to;
    const cutoff = new Date(now.date + "T12:00:00Z");
    if (range !== "all" && range !== "custom") cutoff.setUTCDate(cutoff.getUTCDate() - Number(range) + 1);
    const first = range === "custom" ? from : range === "all" ? "" : cutoff.toISOString().slice(0, 10);
    const last = range === "custom" ? to : "";
    const query = search.trim().toLowerCase();
    return bookings.filter(b => {
      if (b.archived_at && !filters.showArchived) return false;
      const minutes = parseBookingTime(b.booking_time);
      if (b.booking_date > now.date || (b.booking_date === now.date && (minutes === null || minutes >= now.minutes))) return false;
      if (invalidRange || (first && b.booking_date < first) || (last && b.booking_date > last)) return false;
      if (status !== "all" && b.status !== status) return false;
      if (payment !== "all" && (paymentMap.get(b.id)?.payment_status ?? "unpaid") !== payment) return false;
      return !query || [historyName(b), b.reference_code, b.guest_email, b.guest_phone, b.profiles?.phone].some(v => v?.toLowerCase().includes(query));
    }).sort((a, b) => b.booking_date.localeCompare(a.booking_date) || (parseBookingTime(b.booking_time) ?? 0) - (parseBookingTime(a.booking_time) ?? 0) || b.id.localeCompare(a.id));
}

