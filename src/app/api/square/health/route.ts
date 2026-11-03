import { timingSafeEqual } from "node:crypto";
import { invoiceStore, squareCatalog, squareConfigured, squareRequest } from "@/lib/square";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET(request: Request) {
  const secret = process.env.SQUARE_HEALTH_TOKEN;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from("Bearer " + (secret || ""));
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });
  try {
    if (!squareConfigured()) throw new Error("Missing settings.");
    const [catalog, location] = await Promise.all([
      squareCatalog(), squareRequest<{ location: { country: string; currency: string; status: string } }>("/locations/" + encodeURIComponent(process.env.SQUARE_LOCATION_ID!)),
      invoiceStore("booking_square_invoices?select=booking_id&limit=0"),
    ]);
    return Response.json({ success: true, location: { country: location.location.country, currency: location.location.currency, status: location.location.status },
      items: catalog.filter(o => o.type === "ITEM").map(o => ({ name: o.item_data?.name, variations: o.item_data?.variations?.map(v => ({ name: v.item_variation_data?.name, price: v.item_variation_data?.price_money })), taxCount: o.item_data?.tax_ids?.length ?? 0 })),
      modifierLists: catalog.filter(o => o.type === "MODIFIER_LIST").map(o => ({ name: o.modifier_list_data?.name, names: o.modifier_list_data?.modifiers?.map(m => m.modifier_data?.name) })),
      webhookConfigured: !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return Response.json({ success: false, error: e instanceof Error ? e.message : "Square connection failed." }, { status: 503 }); }
}
