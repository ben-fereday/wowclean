import "server-only";
import type { CatalogObject } from "./square-model";
export function squareConfigured() {
  return process.env.VERCEL_ENV === "production" && !!process.env.SQUARE_ACCESS_TOKEN && !!process.env.SQUARE_LOCATION_ID && !!process.env.SUPABASE_SECRET_KEY;
}
export async function squareRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  if (!squareConfigured()) throw new Error("Square is not configured for this environment.");
  const response = await fetch("https://connect.squareup.com/v2" + path, { method,
    headers: { Authorization: "Bearer " + process.env.SQUARE_ACCESS_TOKEN!, "Square-Version": "2026-09-16", "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(8000) });
  const result = await response.json();
  if (!response.ok || result.errors?.length) {
    const code = String(result.errors?.[0]?.code ?? response.status).replace(/[^A-Z0-9_]/g, "").slice(0, 80);
    throw new Error(`Square request failed (${code}). Your booking is unchanged. Retry, or check Square before creating another invoice.`);
  }
  return result as T;
}
export async function squareCatalog() {
  const objects: CatalogObject[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const result: { objects?: CatalogObject[]; cursor?: string } = await squareRequest("/catalog/list?types=ITEM,MODIFIER_LIST" + (cursor ? "&cursor=" + encodeURIComponent(cursor) : ""));
    objects.push(...(result.objects ?? [])); cursor = result.cursor;
    if (!cursor) return objects;
  }
  throw new Error("Square catalog is too large to load in one request.");
}
// New secret keys are application API keys, not JWTs. Never send one as a user bearer token.
export async function invoiceStore<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  if (!squareConfigured()) throw new Error("Square database access is not configured.");
  const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL! + "/rest/v1/" + path, { method,
    headers: { apikey: process.env.SUPABASE_SECRET_KEY!, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Could not save invoice tracking. Retry the same booking; do not create a second invoice in Square.");
  if (response.status === 204) return undefined as T;
  return response.json();
}
