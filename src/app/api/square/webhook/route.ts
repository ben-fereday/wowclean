import { validSquareSignature, type InvoiceRecord } from "@/lib/square-model";
import { invoiceStore, squareConfigured } from "@/lib/square";
import { refreshTrackedInvoice } from "@/lib/square-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const notificationUrl = "https://wowcleancalgary.com/api/square/webhook";
export async function GET() { return Response.json({ service: "Square invoice notifications", ready: squareConfigured() && !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY }); }
export async function POST(request: Request) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !squareConfigured()) return new Response("Not configured", { status: 503 });
  if (Number(request.headers.get("content-length") || 0) > 1000000) return new Response("Too large", { status: 413 });
  const body = await request.text();
  if (body.length > 1000000) return new Response("Too large", { status: 413 });
  if (!validSquareSignature(body, request.headers.get("x-square-hmacsha256-signature") || "", key, notificationUrl)) return new Response("Invalid signature", { status: 403 });
  try {
    const event = JSON.parse(body);
    if (typeof event.type !== "string" || !event.type.startsWith("invoice.")) return new Response("OK");
    const id = event.data?.id;
    if (typeof id !== "string" || id.length > 200) return new Response("Invalid event", { status: 400 });
    const rows = await invoiceStore<InvoiceRecord[]>("booking_square_invoices?invoice_id=eq." + encodeURIComponent(id) + "&select=*");
    if (!rows[0]) return new Response("OK");
    if (event.type === "invoice.deleted") return new Response("OK");
    // Fetch authoritative current state, so retries and out-of-order events cannot roll payment back.
    await refreshTrackedInvoice(rows[0]);
    return new Response("OK");
  } catch {
    console.error("Square invoice notification could not be reconciled.");
    return new Response("Retry later", { status: 503 });
  }
}
