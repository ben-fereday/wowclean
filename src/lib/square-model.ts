import { createHmac, timingSafeEqual } from "node:crypto";

export interface CatalogObject {
  id: string; type: string; is_deleted?: boolean; present_at_all_locations?: boolean;
  present_at_location_ids?: string[]; absent_at_location_ids?: string[];
  item_data?: { name: string; variations?: CatalogObject[]; modifier_list_info?: { modifier_list_id: string; enabled?: boolean }[]; tax_ids?: string[] };
  item_variation_data?: { name: string; pricing_type?: string; price_money?: { amount: number; currency: string } };
  modifier_list_data?: { name: string; modifiers?: CatalogObject[] };
  modifier_data?: { name: string; price_money?: { amount: number; currency: string } };
}
export interface InvoiceBooking {
  id: string; reference_code: string; package: string; vehicle_size: string; service_type: string;
  addons: { id: string; name?: string }[] | null; booking_date: string; status: string;
  guest_first_name?: string; guest_last_name?: string; guest_email?: string; user_id?: string;
}
export interface InvoicePreview {
  email: string; firstName: string; lastName: string; reference: string; dueDate: string;
  lines: { name: string; cents: number }[]; total: number;
  order: { location_id: string; reference_id: string; line_items: Record<string, unknown>[]; discounts?: Record<string, unknown>[]; pricing_options: { auto_apply_taxes: false; auto_apply_discounts: false } };
}
export interface InvoiceRecord {
  booking_id: string; attempt_id: string; snapshot: InvoicePreview;
  customer_id: string | null; order_id: string | null; invoice_id: string | null;
  status: string; version: number; public_url: string | null; total_cents: number;
  recipient_email: string; updated_at: string;
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
function one<T>(items: T[], label: string): T {
  if (items.length !== 1) throw new Error(`Square catalog: expected one ${label}, found ${items.length}. Check the item names in Square.`);
  return items[0];
}
const money = (value: { amount: number; currency: string } | undefined) => {
  if (!value || value.currency !== "CAD" || !Number.isSafeInteger(value.amount) || value.amount < 0) throw new Error("Square item must have a fixed CAD price.");
  return value.amount;
};
function available(obj: CatalogObject, location: string) {
  return !obj.is_deleted && !obj.absent_at_location_ids?.includes(location) &&
    (obj.present_at_all_locations !== false || !!obj.present_at_location_ids?.includes(location));
}
export function buildInvoicePreview(booking: InvoiceBooking, catalog: CatalogObject[], location: string, finalAmount: string, email: string, firstName: string, lastName: string, today: string): InvoicePreview {
  if (!["standard", "premium"].includes(booking.package) || !["interior", "exterior", "full"].includes(booking.service_type) || !["small", "medium", "large"].includes(booking.vehicle_size)) throw new Error("Unsupported booking package or vehicle size.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("A valid customer email is required.");
  const pkg = booking.package === "standard" ? "The Standard" : "Premium Detail";
  const services = booking.service_type === "full" ? ["Complete Detail", "Full Detail"] : [booking.service_type === "interior" ? "Interior" : "Exterior", booking.service_type === "interior" ? "Interior Only" : "Exterior Only"];
  const names = services.map(s => norm(pkg + s));
  const item = one(catalog.filter(o => o.type === "ITEM" && available(o, location) && names.includes(norm(o.item_data?.name ?? ""))), pkg + " " + services[0]);
  if (item.item_data?.tax_ids?.length) throw new Error("This Square item has taxes configured. Tax mapping must be reviewed before invoicing from the website; use Square directly for now.");
  const variation = one((item.item_data?.variations ?? []).filter(o => available(o, location) && norm(o.item_variation_data?.name ?? "") === booking.vehicle_size), booking.vehicle_size + " variation");
  const base = money(variation.item_variation_data?.price_money);
  const lines = [{ name: `${item.item_data!.name} — ${variation.item_variation_data!.name}`, cents: base }];
  const modifiers: Record<string, unknown>[] = [];
  const lists = new Set((item.item_data?.modifier_list_info ?? []).filter(l => l.enabled !== false).map(l => l.modifier_list_id));
  const aliases: Record<string, string[]> = { salt: ["Heavy Salt / Sand Cleanup"], pet_hair: ["Pet Hair Removal"], seat_shamp: ["Seat Shampoo"], carpet_shamp: ["Carpet Shampoo"], leather: ["Leather Conditioning"], iron: ["Iron / Fallout Decontamination", "Iron / Fallout Paint Decontamination"], clay: ["Clay Bar Treatment", "Clay Bar Paint Treatment"], engine: ["Engine Bay Detail"], sealant: ["Protective Sealant"] };
  const seen = new Set<string>();
  for (const addon of booking.addons ?? []) {
    if (seen.has(addon.id)) throw new Error("Duplicate booking add-on.");
    seen.add(addon.id);
    const candidates = new Set([addon.name ?? "", ...(aliases[addon.id] ?? [])].filter(Boolean).map(norm));
    const mod = one(catalog.filter(o => lists.has(o.id) && available(o, location)).flatMap(o => o.modifier_list_data?.modifiers ?? []).filter(o => available(o, location) && candidates.has(norm(o.modifier_data?.name ?? ""))), addon.name || addon.id);
    const cents = money(mod.modifier_data?.price_money);
    modifiers.push({ catalog_object_id: mod.id, quantity: "1", base_price_money: { amount: cents, currency: "CAD" } });
    lines.push({ name: mod.modifier_data!.name, cents });
  }
  const catalogTotal = lines.reduce((sum, l) => sum + l.cents, 0);
  let total = catalogTotal;
  if (finalAmount.trim()) {
    if (!/^\d{1,6}(\.\d{1,2})?$/.test(finalAmount.trim())) throw new Error("Enter a valid final total with up to two decimals.");
    total = Math.round(Number(finalAmount) * 100);
  }
  if (!Number.isSafeInteger(total) || total <= 0 || total > 99999999) throw new Error("Invoice total must be between $0.01 and $999,999.99.");
  const line_items: Record<string, unknown>[] = [{ catalog_object_id: variation.id, quantity: "1", base_price_money: { amount: base, currency: "CAD" }, ...(modifiers.length ? { modifiers } : {}) }];
  const adjustment = total - catalogTotal;
  if (adjustment > 0) line_items.push({ name: "Final price adjustment", quantity: "1", base_price_money: { amount: adjustment, currency: "CAD" } });
  if (adjustment) lines.push({ name: adjustment > 0 ? "Final price adjustment" : "Discount / price adjustment", cents: adjustment });
  return { email: email.trim(), firstName, lastName, reference: booking.reference_code, dueDate: booking.booking_date > today ? booking.booking_date : today, lines, total,
    order: { location_id: location, reference_id: booking.reference_code, line_items, ...(adjustment < 0 ? { discounts: [{ uid: "final-adjustment", name: "Discount / price adjustment", type: "FIXED_AMOUNT", scope: "ORDER", amount_money: { amount: -adjustment, currency: "CAD" } }] } : {}), pricing_options: { auto_apply_taxes: false, auto_apply_discounts: false } } };
}
export function validSquareSignature(body: string, signature: string, key: string, url: string) {
  const expected = Buffer.from(createHmac("sha256", key).update(url + body).digest("base64"));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
