/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, dependencies, env, now) {
  const out = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  new Function("require", "module", "exports", "process", "Date", code)(
    name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    out, out.exports, { env }, FixedDate,
  );
  return out.exports;
}

const now = Date.parse("2026-11-05T16:00:00Z");
function fixture({ env = "production", date = "2026-11-06", time = "10:00 AM", invoice = null, paid = false, archived = false, busy = [], stale = false } = {}) {
  const calls = [];
  const booking = { id: "one", booking_date: date, booking_time: time, status: "confirmed", reference_code: "TEST", guest_email: "customer@example.invalid", package: "standard", vehicle_size: "small", addons: [] };
  const client = {
    rpc: async (_name, args) => { calls.push(["availability", args]); return { data: busy }; },
    from(table) {
      const filters = [];
      let patch;
      const q = {
        select: () => q,
        eq: (key, value) => { filters.push([key, value]); return q; },
        update: value => { patch = value; return q; },
        single: async () => ({ data: booking }),
        maybeSingle: async () => {
          if (patch) {
            calls.push(["update", filters, patch]);
            return { data: stale ? null : { ...booking, ...patch } };
          }
          return { data: table === "booking_square_invoices" ? invoice : table === "booking_admin_archives" ? archived : paid ? { payment_status: "paid" } : null };
        },
      };
      return q;
    },
  };
  const actions = load("src/app/manage-booking/self-service.ts", {
    "@supabase/supabase-js": { createClient: () => client },
    "next/cache": { revalidatePath() {} },
    resend: { Resend: class { emails = { send: async mail => { calls.push(["email", mail.to]); return {}; } }; } },
    "@/lib/booking-access": { verifyBookingAccessToken: token => token === "valid" ? "one" : null, bookingManageUrl: () => "https://example.invalid/#token=new" },
    "@/lib/booking-schedule": load("src/lib/booking-schedule.ts", {}, {}, now),
    "@/lib/google-availability": { getExternalUnavailableTimes: async () => ["11:00 AM"] },
    "@/lib/google-calendar": { syncBookingCalendar: async data => { calls.push(["calendar", data.status]); return { success: true }; } },
    "@/lib/rate-limit": { checkRateLimit: () => ({ allowed: true }) },
  }, { VERCEL_ENV: env, RESEND_API_KEY: "mock" }, now);
  return { calls, actions, cancel: { kind: "cancel", expectedDate: date, expectedTime: time } };
}

test("preview, invalid links, the 24-hour cutoff, and staff-only records cannot save", async () => {
  for (const options of [{ env: "preview" }, { time: "9:59 AM" }, { invoice: {} }, { paid: true }, { archived: true }]) {
    const f = fixture(options);
    assert.ok((await f.actions.changeCustomerBooking("valid", f.cancel)).error);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture();
  assert.ok((await f.actions.changeCustomerBooking("invalid", f.cancel)).error);
  assert.deepEqual(f.calls, []);
});

test("exactly 24 hours allows scoped cancellation and notifies after the write", async () => {
  const f = fixture();
  const result = await f.actions.changeCustomerBooking("valid", f.cancel);
  assert.equal(result.status, "cancelled");
  assert.equal(result.emailSent, true);
  assert.deepEqual(f.calls[0], ["update", [["id","one"],["status","confirmed"],["booking_date","2026-11-06"],["booking_time","10:00 AM"]], { status: "cancelled" }]);
  assert.deepEqual(f.calls.slice(1).map(call => call[0]), ["calendar", "email", "email"]);
});

test("busy times are filtered and stale updates send no confirmation", async () => {
  const f = fixture({ busy: ["10:00 AM"], stale: true });
  const date = "2026-11-08";
  const { times } = await f.actions.getCustomerChangeTimes("valid", date);
  assert.ok(times.includes("9:00 AM"));
  assert.ok(!times.includes("10:00 AM") && !times.includes("11:00 AM"));
  const change = { ...f.cancel, kind: "reschedule", date };
  assert.match((await f.actions.changeCustomerBooking("valid", { ...change, time: "10:00 AM" })).error, /unavailable/);
  assert.match((await f.actions.changeCustomerBooking("valid", { ...change, time: "9:00 AM" })).error, /Refresh/);
  assert.ok(f.calls.every(call => ["availability", "update"].includes(call[0])));
});

test("an available time is saved with the expected booking and date filters", async () => {
  const f = fixture();
  const result = await f.actions.changeCustomerBooking("valid", { ...f.cancel, kind: "reschedule", date: "2026-11-08", time: "9:00 AM" });
  assert.equal(result.bookingDate, "2026-11-08");
  assert.equal(result.bookingTime, "9:00 AM");
  assert.equal(result.status, "confirmed");
  assert.deepEqual(f.calls[1], ["update", [["id","one"],["status","confirmed"],["booking_date","2026-11-06"],["booking_time","10:00 AM"]], { booking_date: "2026-11-08", booking_time: "9:00 AM" }]);
});
