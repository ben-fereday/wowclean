"use server";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { buildInvoicePreview, type InvoiceBooking, type InvoicePreview, type InvoiceRecord } from "@/lib/square-model";
import { invoiceStore, squareCatalog, squareConfigured, squareRequest } from "@/lib/square";
import { refreshTrackedInvoice, type SquareInvoice } from "@/lib/square-sync";

async function authorized(bookingId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) throw new Error("Invalid booking.");
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error("Sign in to manage invoices.");
  const { data: profile, error } = await client.from("profiles").select("role").eq("id", user.id).single();
  if (error || !profile || !["admin", "owner"].includes(profile.role)) throw new Error("Admin access required.");
  const { data: booking, error: bookingError } = await client.from("bookings").select("*").eq("id", bookingId).single();
  if (bookingError || !booking) throw new Error("Booking not found.");
  return { client, booking: booking as InvoiceBooking };
}
const hash = (preview: InvoicePreview) => createHash("sha256").update(JSON.stringify(preview)).digest("hex");
async function tracked(id: string) {
  const rows = await invoiceStore<InvoiceRecord[]>("booking_square_invoices?booking_id=eq." + id + "&select=*");
  return rows[0] ?? null;
}
async function save(id: string, fields: Partial<InvoiceRecord>) {
  const rows = await invoiceStore<InvoiceRecord[]>("booking_square_invoices?booking_id=eq." + id, "PATCH", { ...fields, updated_at: new Date().toISOString() });
  if (!rows[0]) throw new Error("Invoice tracking record not found.");
  return rows[0];
}
async function previewFor(id: string, amount: string) {
  const { client, booking } = await authorized(id);
  if (["cancelled", "no_show"].includes(booking.status)) throw new Error("Create invoices only for confirmed or completed bookings.");
  const { data: payment } = await client.from("booking_admin_details").select("payment_status").eq("booking_id", id).maybeSingle();
  if (payment?.payment_status === "paid") throw new Error("This booking is already marked paid. Review its payment record before creating an invoice.");
  let email = booking.guest_email || "";
  let firstName = booking.guest_first_name || "";
  let lastName = booking.guest_last_name || "";
  if (!email && booking.user_id) {
    const { data, error } = await client.rpc("find_user_by_email_id", { user_id_input: booking.user_id });
    if (error) throw new Error("Could not look up the customer email.");
    email = data?.[0]?.email || "";
    const { data: profile } = await client.from("profiles").select("first_name,last_name").eq("id", booking.user_id).maybeSingle();
    firstName = profile?.first_name || firstName; lastName = profile?.last_name || lastName;
  }
  const locationId = process.env.SQUARE_LOCATION_ID!;
  const [catalog, locationResult] = await Promise.all([squareCatalog(), squareRequest<{ location: { status: string; country: string; currency: string } }>("/locations/" + encodeURIComponent(locationId))]);
  if (locationResult.location.status !== "ACTIVE" || locationResult.location.country !== "CA" || locationResult.location.currency !== "CAD") throw new Error("Square must use an active Canadian location in CAD.");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return buildInvoicePreview(booking, catalog, locationId, amount, email, firstName, lastName, today);
}
export async function getSquareInvoice(bookingId: string) {
  await authorized(bookingId);
  return { configured: squareConfigured(), webhookConfigured: !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY, invoice: squareConfigured() ? await tracked(bookingId) : null };
}
export async function previewSquareInvoice(bookingId: string, finalAmount: string) {
  const preview = await previewFor(bookingId, finalAmount);
  return { preview, fingerprint: hash(preview) };
}
export async function createSquareInvoice(bookingId: string, finalAmount: string, fingerprint: string) {
  const { booking } = await authorized(bookingId);
  if (["cancelled", "no_show"].includes(booking.status)) throw new Error("This booking is no longer active.");
  let record = await tracked(bookingId);
  if (!record) {
    const preview = await previewFor(bookingId, finalAmount);
    if (hash(preview) !== fingerprint) throw new Error("Booking, catalog, or amount changed. Preview the invoice again.");
    // One immutable attempt per booking. Concurrent requests recover the same snapshot and keys.
    await invoiceStore("booking_square_invoices?on_conflict=booking_id", "POST", { booking_id: bookingId, snapshot: preview, recipient_email: preview.email, total_cents: preview.total }).catch(async (error) => { if (!await tracked(bookingId)) throw error; });
    record = await tracked(bookingId);
  }
  if (!record) throw new Error("Could not reserve invoice tracking.");
  if (record.invoice_id) return record;
  const key = (step: string) => "wc-" + record!.attempt_id + "-" + step;
  const p = record.snapshot;
  if (!record.customer_id) {
    const result = await squareRequest<{ customer: { id: string } }>("/customers", "POST", { idempotency_key: key("customer"), given_name: p.firstName || "Customer", ...(p.lastName ? { family_name: p.lastName } : {}), email_address: p.email, reference_id: p.reference });
    record = await save(bookingId, { customer_id: result.customer.id });
  }
  if (!record.order_id) {
    const result = await squareRequest<{ order: { id: string; total_money: { amount: number; currency: string } } }>("/orders", "POST", { idempotency_key: key("order"), order: { ...p.order, customer_id: record.customer_id } });
    record = await save(bookingId, { order_id: result.order.id });
    if (result.order.total_money.currency !== "CAD" || result.order.total_money.amount !== p.total) throw new Error("Square calculated a different total. Review the order in Square before continuing.");
  }
  // Re-read the actual total on every retry before creating any invoice.
  const order = await squareRequest<{ order: { total_money: { amount: number; currency: string } } }>("/orders/" + encodeURIComponent(record.order_id!));
  if (order.order.total_money.currency !== "CAD" || order.order.total_money.amount !== p.total) throw new Error("Square order total differs from your preview. Review it in Square.");
  const result = await squareRequest<{ invoice: SquareInvoice }>("/invoices", "POST", { idempotency_key: key("invoice"), invoice: {
    order_id: record.order_id, location_id: p.order.location_id,
    primary_recipient: { customer_id: record.customer_id },
    title: "WOW CLEAN — " + p.reference,
    description: "Detailing service — booking " + p.reference + ". Payment due after service. No automatic card charges.",
    delivery_method: "EMAIL", accepted_payment_methods: { card: true },
    payment_requests: [{ request_type: "BALANCE", due_date: p.dueDate, automatic_payment_source: "NONE" }],
  } });
  await invoiceStore("booking_square_invoices?booking_id=eq." + bookingId + "&invoice_id=is.null", "PATCH", { invoice_id: result.invoice.id, status: result.invoice.status, version: result.invoice.version });
  return (await tracked(bookingId))!;
}
export async function refreshSquareInvoice(bookingId: string) {
  await authorized(bookingId);
  const record = await tracked(bookingId);
  if (!record?.invoice_id) throw new Error("No Square invoice exists yet.");
  await refreshTrackedInvoice(record);
  return tracked(bookingId);
}
export async function sendSquareInvoice(bookingId: string, expectedVersion: number, expectedTotal: number, expectedEmail: string) {
  const { booking } = await authorized(bookingId);
  if (["cancelled", "no_show"].includes(booking.status)) throw new Error("This booking is no longer active. Review the invoice in Square.");
  let record = await tracked(bookingId);
  if (!record?.invoice_id) throw new Error("Create a draft first.");
  const invoice = await refreshTrackedInvoice(record);
  record = (await tracked(bookingId))!;
  if (invoice.status !== "DRAFT") return record; // already sent; never send duplicate emails
  if (invoice.version !== expectedVersion || record.total_cents !== expectedTotal || record.recipient_email !== expectedEmail) throw new Error("Invoice changed in Square. Refresh and review before sending.");
  await squareRequest("/invoices/" + encodeURIComponent(invoice.id) + "/publish", "POST", { version: invoice.version, idempotency_key: "wc-" + record.attempt_id + "-publish" });
  await refreshTrackedInvoice(record);
  return tracked(bookingId);
}
