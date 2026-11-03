import { timingSafeEqual } from "node:crypto";
import { checkCalendarConnection } from "@/lib/google-calendar";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.GOOGLE_CALENDAR_HEALTH_TOKEN;
  const actual = request.headers.get("authorization") || "";
  const expected = "Bearer " + secret;
  if (!secret || actual.length !== expected.length || !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await checkCalendarConnection();
  return Response.json(result, { status: result.success ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
