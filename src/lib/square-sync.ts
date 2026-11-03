import "server-only";
import { invoiceStore, squareRequest } from "./square";
import type { InvoiceRecord } from "./square-model";
export interface SquareInvoice {
  id: string; version: number; status: string; location_id: string; order_id: string;
  public_url?: string; primary_recipient?: { email_address?: string };
}
export async function refreshTrackedInvoice(record: InvoiceRecord) {
  const { invoice } = await squareRequest<{ invoice: SquareInvoice }>("/invoices/" + encodeURIComponent(record.invoice_id!));
  if (invoice.id !== record.invoice_id || invoice.order_id !== record.order_id || invoice.location_id !== process.env.SQUARE_LOCATION_ID) throw new Error("Square invoice identity mismatch.");
  const { order } = await squareRequest<{ order: { total_money: { amount: number; currency: string } } }>("/orders/" + encodeURIComponent(invoice.order_id));
  const total = order.total_money;
  if (total.currency !== "CAD" || !Number.isSafeInteger(total.amount) || total.amount <= 0) throw new Error("Invalid Square invoice total.");
  const url = invoice.public_url ? new URL(invoice.public_url) : null;
  if (url && (url.protocol !== "https:" || !(url.hostname === "squareup.com" || url.hostname.endsWith(".squareup.com")) )) throw new Error("Unexpected Square payment link.");
  await invoiceStore("rpc/reconcile_square_invoice", "POST", {
    p_booking: record.booking_id, p_invoice: invoice.id, p_version: invoice.version, p_status: invoice.status,
    p_total: total.amount, p_url: invoice.public_url ?? null, p_email: invoice.primary_recipient?.email_address ?? record.recipient_email,
  });
  return invoice;
}
