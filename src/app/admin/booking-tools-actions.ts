"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import { bookingManageUrl } from "@/lib/booking-access";
import { getExternalUnavailableTimes } from "@/lib/google-availability";
import { syncBookingCalendar } from "@/lib/google-calendar";
import { getBookingDurationMinutes, formatBookingTime, getBookableTimeSlots, isScheduledBookingTime, parseBookingTime } from "@/lib/booking-schedule";
import { parseFinalAmount, type PaymentStatus, type PaymentMethod, type BookingAdminDetails } from "@/lib/admin-booking";
import { PACKAGE_LABELS, SERVICE_TYPE_LABELS, type PackageId, type ServiceType } from "@/lib/constants";

async function adminClient() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Sign in to manage bookings.");
  const { data: profile, error } = await client.from("profiles").select("role").eq("id", user.id).single();
  if (error || !profile || !["admin", "owner"].includes(profile.role)) throw new Error("Admin access required.");
  return { client, user };
}

export async function getBookingManageLink(bookingId: string) {
  const { client } = await adminClient();
  const { data: booking, error } = await client.from("bookings").select("id,booking_date").eq("id", bookingId).single();
  if (error || !booking) throw new Error("Could not load this booking.");
  return bookingManageUrl(booking.id, booking.booking_date);
}

export async function getBookingAdminDetails(bookingId: string): Promise<BookingAdminDetails | null> {
  const { client } = await adminClient();
  const { data, error } = await client.from("booking_admin_details").select("*").eq("booking_id", bookingId).maybeSingle();
  if (error) throw new Error("Could not load payment details and private notes.");
  return data;
}

export async function saveBookingAdminDetails(bookingId: string, input: {
  paymentStatus: PaymentStatus; paymentMethod: PaymentMethod | ""; finalAmount: string; notes: string;
}) {
  const { client, user } = await adminClient();
  if (!["unpaid", "paid"].includes(input.paymentStatus)) return { error: "Choose a valid payment status." };
  if (input.paymentMethod && !["credit", "debit", "cash", "e_transfer", "square"].includes(input.paymentMethod)) return { error: "Choose a valid payment method." };
  if (input.notes.length > 5000) return { error: "Private notes must be 5,000 characters or fewer." };
  let amount: number | null;
  try { amount = parseFinalAmount(input.finalAmount); }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid amount." }; }
  if (input.paymentStatus === "paid" && (amount === null || !input.paymentMethod))
    return { error: "Record the final amount and payment method before marking this paid." };
  const { data: invoice, error: invoiceError } = await client.from("booking_square_invoices").select("status,total_cents").eq("booking_id", bookingId).maybeSingle();
  if (invoiceError) return { error: "Could not verify Square payment status. Please retry." };
  if (invoice?.status === "PAID") {
    input.paymentStatus = "paid"; input.paymentMethod = "square"; amount = Number(invoice.total_cents) / 100;
  }
  const { error } = await client.from("booking_admin_details").upsert({
    booking_id: bookingId, payment_status: input.paymentStatus, payment_method: input.paymentMethod || null,
    final_amount: amount, internal_notes: input.notes.trim(), updated_by: user.id, updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Could not save payment details and notes." };
  revalidatePath("/admin");
  return { success: true };
}

export async function getAdminRescheduleTimes(bookingId: string, date: string) {
  const { client } = await adminClient();
  const { data: booking, error: bookingError } = await client.from("bookings").select("package,vehicle_size,addons").eq("id", bookingId).single();
  if (bookingError || !booking) throw new Error("Booking not found.");
  const durationMinutes = getBookingDurationMinutes(booking.package, booking.vehicle_size, booking.addons ?? []);
  const slots = getBookableTimeSlots(date, new Date(), durationMinutes);
  if (!slots.length) return [];
  const [bookingResult, externalTimes] = await Promise.all([
    client.rpc("booking_busy_times_for_duration", { p_date: date, p_exclude: bookingId, p_duration: durationMinutes }),
    getExternalUnavailableTimes(date, durationMinutes),
  ]);
  if (bookingResult.error) throw new Error("Could not check appointment availability.");
  const busy = new Set<string>([...(bookingResult.data ?? []), ...externalTimes]);
  return slots.filter((slot) => !busy.has(slot));
}

function escapeHtml(value: unknown) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (char) => entities[char]);
}

export async function rescheduleBooking(bookingId: string, date: string, time: string, expectedDate: string, expectedTime: string) {
  const { client } = await adminClient();
  if (!isScheduledBookingTime(date, time)) return { error: "Choose a future appointment within your Calgary working hours." };
  const normalized = formatBookingTime(parseBookingTime(time)!);
  const { data: booking, error: fetchError } = await client.from("bookings").select("*").eq("id", bookingId).single();
  if (fetchError || !booking) return { error: "Booking not found." };
  if (booking.status !== "confirmed") return { error: "Only confirmed bookings can be rescheduled." };
  if (booking.booking_date !== expectedDate || booking.booking_time !== expectedTime) return { error: "This booking changed. Close and reopen it before rescheduling." };
  if (booking.booking_date === date && booking.booking_time === normalized) return { error: "Choose a different date or time." };
  const slots = await getAdminRescheduleTimes(bookingId, date);
  if (!slots.includes(normalized)) return { error: "That appointment is no longer available." };
  const { data: changed, error } = await client.from("bookings")
    .update({ booking_date: date, booking_time: normalized })
    .eq("id", bookingId).eq("status", "confirmed").eq("booking_date", expectedDate).eq("booking_time", expectedTime)
    .select("id").maybeSingle();
  if (error) return { error: error.code === "23514" ? error.message : "Could not reschedule this booking." };
  if (!changed) return { error: "This booking changed. Refresh and try again." };
  revalidatePath("/admin");
  revalidatePath("/account");
  const calendarResult = await syncBookingCalendar({ ...booking, booking_date: date, booking_time: normalized });
  const calendarWarning = calendarResult.success ? undefined : calendarResult.error;
  const warning = (calendarWarning ? calendarWarning + " " : "") + "Booking rescheduled, but the customer email could not be sent. Please contact them directly.";
  let email: string | null = booking.guest_email;
  if (!email && booking.user_id) {
    try {
      const { data } = await client.rpc("find_user_by_email_id", { user_id_input: booking.user_id });
      email = data?.[0]?.email ?? null;
    } catch { return { success: true, emailSent: false, warning }; }
  }
  if (!email || !process.env.RESEND_API_KEY) return { success: true, emailSent: false, warning };
  try {
    const dateText = new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeZone: "America/Edmonton" })
      .format(new Date(date + "T12:00:00Z"));
    const oldDateText = new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeZone: "America/Edmonton" })
      .format(new Date(expectedDate + "T12:00:00Z"));
    const manageUrl = bookingManageUrl(bookingId, date);
    const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: "WowClean <info@wowcleancalgary.com>", to: email, replyTo: "teamwowclean@gmail.com",
      subject: `Booking Rescheduled — ${booking.reference_code}`,
      text: `Hi ${booking.guest_first_name || "there"}, your WOW CLEAN appointment has been rescheduled.\n\nNew appointment: ${dateText} at ${normalized} (Calgary time).\nPrevious appointment: ${oldDateText} at ${expectedTime}.\nPackage: ${PACKAGE_LABELS[booking.package as PackageId] || booking.package}.\nService: ${SERVICE_TYPE_LABELS[booking.service_type as ServiceType] || booking.service_type}.\nAddress: ${booking.service_address || booking.guest_address || "Please contact us"}.\nReference: ${booking.reference_code}.\n\nManage your booking: ${manageUrl}\nNo account needed. Keep this link private.\n\nCustomer-provided power is required. Winter appointments require a suitable heated workspace. Payment is due upon completion.\nQuestions? Reply to this email or call (587) 436-9605.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#17213d"><h1>WOW CLEAN</h1><h2>Your appointment has been rescheduled</h2><p>Hi ${escapeHtml(booking.guest_first_name || "there")}, here are your updated booking details.</p><p><strong>New date:</strong> ${escapeHtml(dateText)}<br><strong>Start time:</strong> ${escapeHtml(normalized)} (Calgary time)</p><p><strong>Previously:</strong> ${escapeHtml(oldDateText)} at ${escapeHtml(expectedTime)}</p><p><strong>Package:</strong> ${escapeHtml(PACKAGE_LABELS[booking.package as PackageId] || booking.package)}<br><strong>Service:</strong> ${escapeHtml(SERVICE_TYPE_LABELS[booking.service_type as ServiceType] || booking.service_type)}<br><strong>Address:</strong> ${escapeHtml(booking.service_address || booking.guest_address || "Please contact us")}<br><strong>Reference:</strong> ${escapeHtml(booking.reference_code)}</p><p><a href="${manageUrl}">Manage my booking</a> — view details or request a change without an account. Keep this link private.</p><p>Customer-provided power is required. Winter appointments require a suitable heated workspace. Payment is due upon completion.</p><p>Questions? Reply to this email or call <a href="tel:+15874369605">(587) 436-9605</a>.</p></div>`,
    });
    if (result.error) return { success: true, emailSent: false, warning };
    return { success: true, emailSent: true, warning: calendarWarning };
  } catch {
    return { success: true, emailSent: false, warning };
  }
}

export async function syncAdminBookingCalendar(bookingId: string) {
  const { client } = await adminClient();
  const { data: booking, error } = await client.from("bookings").select("*").eq("id", bookingId).single();
  if (error || !booking) return { success: false, error: "Booking not found." };
  return syncBookingCalendar(booking);
}

export async function syncCalendarRange(start: string, end: string, cursor?: string) {
  const { client } = await adminClient();
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const days = (Date.parse(end) - Date.parse(start)) / 86400000;
  if (!validDate(start) || !validDate(end) || days <= 0 || days > 62)
    throw new Error("Choose a calendar view covering up to two months.");
  if (cursor && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor))
    throw new Error("Invalid sync cursor.");
  let query = client.from("bookings").select("*").gte("booking_date", start).lt("booking_date", end).order("id").limit(4);
  if (cursor) query = query.gt("id", cursor);
  const { data, error } = await query;
  if (error) throw new Error("Could not load bookings for calendar sync.");
  const batch = (data ?? []).slice(0, 3);
  const results = await Promise.all(batch.map((booking) => syncBookingCalendar(booking)));
  return {
    synced: results.filter((result) => result.success).length,
    failed: results.filter((result) => !result.success).length,
    nextCursor: (data?.length ?? 0) > 3 ? batch[batch.length - 1].id as string : null,
  };
}


