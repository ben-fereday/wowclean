const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, dependencies = {}, env = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", code)(
    name => dependencies[name] ?? require(name), module, module.exports, { env },
  );
  return module.exports;
}

function fixture({ env = {}, lookupError = false, emailError } = {}) {
  const calls = [];
  const booking = {
    id: "f193f9e8-9777-4200-a33d-0c5ff3928a20",
    reference_code: "WOW-SAMPLE", guest_email: "sample@example.invalid",
    booking_time: "10:00 AM", service_type: "interior",
  };
  const query = {
    select: () => query,
    eq: (...args) => { calls.push(["eq", ...args]); return query; },
    not: (...args) => { calls.push(["not", ...args]); return query; },
    is: (...args) => { calls.push(["is", ...args]); return query; },
    order: async () => lookupError ? { error: {} } : { data: [booking] },
  };
  const config = {
    VERCEL_ENV: "production", CRON_SECRET: "fixture-secret",
    NEXT_PUBLIC_SUPABASE_URL: "https://db.example.invalid", SUPABASE_SECRET_KEY: "test-db-key",
    RESEND_API_KEY: "test-email-key", ...env,
  };
  const schedule = load("src/lib/booking-schedule.ts");
  const access = load("src/lib/booking-access.ts", { "server-only": {} }, config);
  const route = load("src/app/api/cron/booking-reminders/route.ts", {
    "@supabase/supabase-js": { createClient: () => ({ from(table) { calls.push(["from", table]); return query; } }) },
    resend: { Resend: class {
      emails = { send: async (message, options) => {
        calls.push(["send", message, options]);
        return emailError ? { error: { name: emailError } } : { data: { id: "sample-email" } };
      } };
    } },
    "@/lib/booking-schedule": { getCalgaryNow: () => schedule.getCalgaryNow(new Date("2026-12-31T04:00:00Z")) },
    "@/lib/booking-access": access,
  }, config);
  return {
    run: (token = "fixture-secret") => route.GET(new Request("https://example.invalid/api/cron/booking-reminders", {
      headers: { authorization: "Bearer " + token },
    })),
    calls, booking, access,
  };
}

test("preview and unauthorized production calls stop before touching bookings or email", async () => {
  for (const [env, token, status] of [
    [{ VERCEL_ENV: "preview" }, "fixture-secret", 404],
    [{}, "wrong", 401],
    [{ CRON_SECRET: undefined }, "fixture-secret", 401],
    [{ RESEND_API_KEY: undefined }, "fixture-secret", 503],
  ]) {
    const f = fixture({ env });
    assert.equal((await f.run(token)).status, status);
    assert.deepEqual(f.calls, []);
  }
});

test("looks up confirmed, unarchived appointments two Calgary dates ahead and sends a private link", async () => {
  const f = fixture();
  assert.deepEqual(await (await f.run()).json(), { accepted: 1, failed: 0 });
  assert.deepEqual(f.calls.slice(0, 5), [
    ["from", "bookings"], ["eq", "booking_date", "2027-01-01"], ["eq", "status", "confirmed"],
    ["not", "guest_email", "is", null], ["is", "booking_admin_archives", null],
  ]);
  const [, message, options] = f.calls[5];
  assert.equal(message.to, "sample@example.invalid");
  assert.match(message.text, /Friday, January 1 at 10:00 AM \(Calgary time\)/);
  assert.match(message.text, /heated indoor workspace/);
  assert.match(message.text, /24 hours/);
  const token = message.text.match(/wowcleancalgary\.com\/manage-booking#token=(\S+)/)[1];
  assert.equal(f.access.verifyBookingAccessToken(token), f.booking.id);
  await f.run();
  assert.equal(options.idempotencyKey, `booking-reminder/${f.booking.id}/2027-01-01`);
  assert.deepEqual(f.calls.at(-1), ["send", message, options]);
});

test("failed lookups send nothing and delivery failures produce an error status", async () => {
  const lookup = fixture({ lookupError: true });
  assert.equal((await lookup.run()).status, 502);
  assert.equal(lookup.calls.some(([kind]) => kind === "send"), false);
  const delivery = fixture({ emailError: "rate_limit_exceeded" });
  const response = await delivery.run();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { accepted: 0, failed: 1 });
  const duplicate = fixture({ emailError: "invalid_idempotent_request" });
  assert.equal((await duplicate.run()).status, 200);
});
