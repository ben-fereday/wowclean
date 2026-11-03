import { parseBookingTime } from "./booking-schedule";

export interface CustomerProfile {
  id: string; first_name: string; last_name: string; phone: string;
  role: string; email?: string; referral_code?: string; referral_credits?: number;
}
export interface CustomerBooking {
  id: string; user_id: string | null; guest_first_name: string | null;
  guest_last_name: string | null; guest_email: string | null; guest_phone: string | null;
  booking_date: string; booking_time: string; reference_code: string; archived_at?: string | null;
}
export interface AdminCustomer extends CustomerProfile {
  is_guest: boolean; booking_ids: string[]; last_booking_date: string | null; search_text: string;
}
const emailKey = (value?: string | null) => (value ?? "").trim().toLowerCase();

// CRM grouping only. Matching an email never creates an account or grants access.
export function buildAdminCustomers(profiles: readonly CustomerProfile[], bookings: readonly CustomerBooking[], includeArchived = false): AdminCustomer[] {
  const customers = new Map<string, AdminCustomer>();
  const emailProfiles = new Map<string, string[]>();
  for (const profile of profiles) {
    customers.set(profile.id, { ...profile, is_guest: false, booking_ids: [], last_booking_date: null,
      search_text: [profile.first_name, profile.last_name, profile.email, profile.phone, profile.referral_code].filter(Boolean).join(" ").toLowerCase() });
    const email = emailKey(profile.email);
    if (email) emailProfiles.set(email, [...(emailProfiles.get(email) ?? []), profile.id]);
  }
  const ordered = [...bookings].sort((a,b) => b.booking_date.localeCompare(a.booking_date)
    || (parseBookingTime(b.booking_time) ?? 0) - (parseBookingTime(a.booking_time) ?? 0) || b.id.localeCompare(a.id));
  for (const booking of ordered) {
    if (booking.archived_at && !includeArchived) continue;
    const email = emailKey(booking.guest_email);
    const matches = emailProfiles.get(email) ?? [];
    // Prefer an explicit account association; never merge different accounts by contact data.
    const id = booking.user_id && customers.has(booking.user_id) ? booking.user_id
      : !booking.user_id && matches.length === 1 ? matches[0]
      : booking.user_id ? "booking-user:" + booking.user_id
      : email ? "guest:" + email : "guest-booking:" + booking.id;
    let customer = customers.get(id);
    if (!customer) {
      customer = { id, first_name: booking.guest_first_name?.trim() || "Guest", last_name: booking.guest_last_name?.trim() || "",
        phone: booking.guest_phone?.trim() || "", email: email || undefined, role: "customer", is_guest: true,
        booking_ids: [], last_booking_date: null, search_text: "" };
      customers.set(id, customer);
    }
    if (!customer.phone && booking.guest_phone) customer.phone = booking.guest_phone.trim();
    if (!customer.email && email) customer.email = email;
    customer.booking_ids.push(booking.id);
    customer.last_booking_date ??= booking.booking_date;
    customer.search_text += " " + [booking.guest_first_name, booking.guest_last_name, booking.guest_email, booking.guest_phone, booking.reference_code].filter(Boolean).join(" ").toLowerCase();
  }
  return [...customers.values()].sort((a,b) => (a.first_name + " " + a.last_name).localeCompare(b.first_name + " " + b.last_name) || a.id.localeCompare(b.id));
}
