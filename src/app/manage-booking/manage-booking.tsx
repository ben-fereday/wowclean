"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { changeCustomerBooking, getCustomerChangeTimes } from "./self-service";
import { getManagedBooking, requestBookingChange } from "./actions";
import { PACKAGE_LABELS, SERVICE_TYPE_LABELS, VEHICLE_LABELS, type PackageId, type ServiceType, type VehicleSize } from "@/lib/constants";
import { getCalgaryNow, parseBookingTime } from "@/lib/booking-schedule";

type Details = NonNullable<Awaited<ReturnType<typeof getManagedBooking>>>;
const field = "w-full rounded-lg border border-white/20 bg-navy p-3 text-white";
const statusLabels: Record<string, string> = { confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
const money = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

const requestOptions = {
  reschedule: { label: "Change time", placeholder: "Tell us which dates and times work for you." },
  cancel: { label: "Cancel appointment", placeholder: "Tell us you’d like to cancel. You can include a reason if you’d like." },
  other: { label: "Request another change", placeholder: "Tell us what you’d like to change." },
} as const;

type RequestKind = keyof typeof requestOptions;

function sampleBooking(): Details {
  const date = new Date(getCalgaryNow().date + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + 7);
  return {
    reference_code: "DEMO-CALGARY", guest_first_name: "Sample customer",
    booking_date: date.toISOString().slice(0, 10), booking_time: "10:00 AM",
    status: "confirmed", package: "standard", service_type: "interior",
    vehicle_size: "small", vehicle_make: null, vehicle_model: null, vehicle_colour: null,
    service_address: "Sample Calgary address", guest_address: null, total_estimate: 100, addons: [],
  };
}

export default function ManageBooking({ demo = false }: { demo?: boolean }) {
  const [token, setToken] = useState("");
  const [booking, setBooking] = useState<Details | null>(() => demo ? sampleBooking() : null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [kind, setKind] = useState<RequestKind | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [times, setTimes] = useState<string[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [changeNotice, setChangeNotice] = useState("");

  useEffect(() => {
    if (demo) return;
    const changed = () => { setKind(null); setTimes(null); setNewDate(""); setNewTime(""); setChangeNotice(""); setBooking(null); setSent(false); setMessage(""); setRequestError(""); setRetry(v => v + 1); };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    const access = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setToken(access); setLoading(true); setError("");
    if (!access) { setLoading(false); return; }
    getManagedBooking(access).then(data => { if (!cancelled) { setBooking(data); if (!data) setError("This booking link is invalid or expired."); } })
      .catch(() => { if (!cancelled) setError("We couldn’t load your booking. Please retry or contact us."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [demo, retry]);

  const now = getCalgaryNow();
  const upcoming = booking && booking.status === "confirmed" && (booking.booking_date > now.date || (booking.booking_date === now.date && (parseBookingTime(booking.booking_time) ?? 0) > now.minutes));
  const start = booking ? Date.parse(booking.booking_date + "T06:00:00Z") + (parseBookingTime(booking.booking_time) ?? NaN) * 60000 : NaN;
  const canChange = upcoming && start - Date.now() >= 86400000;

  async function checkTimes() {
    if (!newDate || checking) return;
    setChecking(true); setTimes(null); setNewTime(""); setRequestError("");
    try {
      const result = demo ? { times: ["9:00 AM", "12:00 PM", "3:00 PM"] } : await getCustomerChangeTimes(token, newDate);
      if ("error" in result && result.error) setRequestError(result.error);
      else setTimes(result.times ?? []);
    } catch { setRequestError("Could not check availability. Please try again."); }
    finally { setChecking(false); }
  }

  async function confirmChange(event: React.FormEvent) {
    event.preventDefault();
    if (!booking || !canChange || sending || (kind !== "reschedule" && kind !== "cancel")) return;
    setSending(true); setRequestError("");
    try {
      const result = demo ? {
        bookingDate: kind === "cancel" ? booking.booking_date : newDate,
        bookingTime: kind === "cancel" ? booking.booking_time : newTime,
        status: kind === "cancel" ? "cancelled" : "confirmed",
        summary: kind === "cancel" ? "Sample appointment cancelled." : "Sample appointment rescheduled.",
        token: "", emailSent: true,
      } : await changeCustomerBooking(token, {
        kind, date: newDate, time: newTime, expectedDate: booking.booking_date, expectedTime: booking.booking_time,
      });
      if ("error" in result && result.error) {
        setRequestError(result.error);
        return;
      }
      if (!result.bookingDate || !result.bookingTime || !result.status) throw new Error("Missing change result");
      setBooking({ ...booking, booking_date: result.bookingDate, booking_time: result.bookingTime, status: result.status });
      if (result.token) {
        setToken(result.token);
        window.history.replaceState(null, "", "#token=" + result.token);
      }
      setChangeNotice(result.summary + (result.emailSent ? "" : " The change is saved, but we couldn’t confirm email delivery."));
      setKind(null); setTimes(null); setNewDate(""); setNewTime("");
    } catch { setRequestError("Could not confirm the change. Refresh this page to check the appointment before retrying."); }
    finally { setSending(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!kind || !upcoming || sending || message.trim().length < 10 || message.length > 1500) return;
    if (demo) { setSent(true); return; }
    setSending(true); setRequestError("");
    try {
      const result = await requestBookingChange(token, kind, message);
      if (result.error) setRequestError(result.error); else setSent(true);
    } catch { setRequestError("Could not send your request. Please call or email us."); }
    finally { setSending(false); }
  }
  return (
    <main className="min-h-screen bg-dark px-4 pt-28 pb-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <div><h1 className="font-[family-name:var(--font-heading)] text-4xl uppercase text-white">Manage My Booking</h1>
          <p className="mt-2 text-mid">Your appointment details, without an account.</p></div>
        {demo && <p className="rounded-xl border border-cyan/30 bg-cyan/5 p-4 text-sm text-cyan">Preview with a sample appointment. Actions update this sample only. No email is sent.</p>}
        {loading ? <p className="text-mid" role="status">Loading your booking…</p> : error ? (
          <div className="rounded-2xl border border-white/10 p-6 space-y-3"><p className="text-silver" role="alert">{error}</p>
            <button className="text-cyan underline" onClick={() => setRetry(v => v + 1)}>Retry</button>
            <p className="text-sm text-mid">Use the full link in your confirmation email. If it has expired or you need a replacement, contact us below.</p></div>
        ) : !booking ? (
          <div className="rounded-2xl border border-white/10 bg-navy/40 p-6 space-y-3">
            <h2 className="text-xl text-white font-semibold">Have an appointment?</h2>
            <p className="text-mid">Open your confirmation email and select <strong className="text-white">Manage my booking</strong>. Your secure link opens only your appointment.</p>
            <p className="text-sm text-mid">For an older booking or a missing email, contact us with your booking reference. No sign-up needed.</p>
          </div>
        ) : <>
          <section className="rounded-2xl border border-cyan/20 bg-navy/40 p-6 space-y-5" aria-label="Booking details">
            <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-mid">Reference</p><p className="text-xl text-cyan font-semibold">{booking.reference_code}</p></div>
              <span className="self-start rounded-full border border-white/20 px-3 py-1 text-sm text-silver">{statusLabels[booking.status] ?? booking.status}</span></div>
            <p className="text-white">Hi {booking.guest_first_name || "there"}, here are your appointment details.</p>
            <dl className="space-y-4 text-sm">
              {[
                ["Date", new Date(booking.booking_date + "T12:00:00Z").toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })],
                ["Time", booking.booking_time + " (Calgary time)"],
                ["Package", PACKAGE_LABELS[booking.package as PackageId] ?? booking.package],
                ["Service", SERVICE_TYPE_LABELS[booking.service_type as ServiceType] ?? booking.service_type],
                ["Vehicle", [booking.vehicle_colour, booking.vehicle_make, booking.vehicle_model].filter(Boolean).join(" ") || VEHICLE_LABELS[booking.vehicle_size as VehicleSize]],
                ["Service address", booking.service_address || booking.guest_address || "Contact us to confirm"],
                ["Add-ons", booking.addons?.length ? booking.addons.map(a => a.name).join(", ") : "None"],
              ].map(([label, value]) => <div key={label} className="grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr] gap-3 border-b border-white/10 pb-3"><dt className="text-mid">{label}</dt><dd className="text-white break-words">{value}</dd></div>)}
            </dl>
            <div className="flex justify-between gap-3 text-white"><span>Estimated total (CAD)</span><strong className="text-cyan">{money(booking.total_estimate)}</strong></div>
            <p className="text-xs text-mid">Your final amount is confirmed after the service. Keep this link private. Anyone with it can view and manage this appointment. It expires 30 days after the appointment date when issued.</p>
          </section>
          {upcoming && <section className="rounded-2xl border border-white/10 p-6 space-y-4" aria-label="Request a booking change">
            <h2 className="text-xl font-semibold text-white">Need to change something?</h2>
            <p className="text-sm text-mid">You can change or cancel online up to 24 hours before your appointment. For later changes, please call WOW CLEAN.</p>
            {sent ? (
              <div className="space-y-3">
                <p className="rounded-lg border border-cyan/30 bg-cyan/5 p-4 text-cyan" role="status">
                  {demo ? "Preview complete. A real request would go to WOW CLEAN for confirmation." : "Your request has been sent. We’ll contact you to confirm. Your appointment has not changed yet."}
                </p>
                {demo && <button type="button" className="text-cyan underline" onClick={() => { setSent(false); setKind(null); setMessage(""); }}>Try another request</button>}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Request type">
                  {(Object.keys(requestOptions) as RequestKind[]).filter(option => option === "other" || canChange).map(option => (
                    <button key={option} type="button" aria-pressed={kind === option} disabled={sending || checking}
                      onClick={() => { setKind(option); setRequestError(""); }}
                      className="rounded-lg border border-white/20 px-4 py-3 text-sm font-semibold text-white hover:border-cyan focus-visible:outline-2 focus-visible:outline-cyan aria-pressed:border-cyan aria-pressed:bg-cyan aria-pressed:text-navy">
                      {requestOptions[option].label}
                    </button>
                  ))}
                </div>
                {kind === "other" && <form onSubmit={submit} className="space-y-4">
                  <label className="block space-y-2 text-sm text-mid">
                    Details
                    <textarea className={field} required minLength={10} maxLength={1500} rows={4}
                      placeholder={requestOptions[kind].placeholder} value={message} disabled={sending}
                      onChange={event => setMessage(event.target.value)} />
                  </label>
                  {requestError && <p className="text-sm text-red-400" role="alert">{requestError}</p>}
                  <button className="rounded-lg bg-cyan px-5 py-3 font-semibold text-navy disabled:opacity-40" disabled={sending || message.trim().length < 10}>
                    {sending ? "Sending…" : "Send request"}
                  </button>
                </form>}
                {canChange && (kind === "reschedule" || kind === "cancel") && (
                  <form onSubmit={confirmChange} className="space-y-4">
                    {kind === "reschedule" ? (
                      <>
                        <label className="block space-y-2 text-sm text-mid">New date
                          <input type="date" className={field} min={now.date} value={newDate} required disabled={checking || sending}
                            onChange={event => { setNewDate(event.target.value); setNewTime(""); setTimes(null); setRequestError(""); }} />
                        </label>
                        <button type="button" className="rounded-lg border border-cyan/30 px-4 py-2 text-cyan disabled:opacity-40"
                          disabled={!newDate || checking || sending} onClick={checkTimes}>{checking ? "Checking…" : "Check available times"}</button>
                        {times && (times.length ? <label className="block space-y-2 text-sm text-mid">New time (Calgary time)
                          <select aria-label="New time (Calgary time)" className={field} value={newTime} required disabled={sending} onChange={event => setNewTime(event.target.value)}>
                            <option value="">Choose a time</option>
                            {times.map(time => <option key={time}>{time}</option>)}
                          </select>
                        </label> : <p className="text-sm text-mid">No times available on this date. Try another date.</p>)}
                        <p className="text-sm text-mid">Confirming replaces your current appointment time.</p>
                      </>
                    ) : (
                      <p className="rounded-lg border border-red-400/30 bg-red-400/5 p-4 text-sm text-white">
                        Cancel your appointment on {booking.booking_date} at {booking.booking_time} Calgary time? Your time slot will be released.
                      </p>
                    )}
                    {requestError && <p className="text-sm text-red-300" role="alert">{requestError}</p>}
                    <button type="submit" className={`rounded-lg px-5 py-3 font-semibold disabled:opacity-40 ${kind === "cancel" ? "bg-red-600 text-white" : "bg-cyan text-navy"}`}
                      disabled={sending || checking || (kind === "reschedule" && !newTime)}>
                      {sending ? "Saving…" : kind === "cancel" ? "Confirm cancellation" : "Confirm new time"}
                    </button>
                  </form>
                )}
              </>
            )}
          </section>}
          {changeNotice && <p role="status" className="rounded-lg border border-cyan/30 bg-cyan/5 p-4 text-cyan">{changeNotice}</p>}
          {!upcoming && <p className="text-sm text-mid">For questions about this appointment, contact WOW CLEAN below.</p>}
        </>}
        <div className="flex flex-wrap gap-4 text-sm"><a className="text-cyan underline" href="tel:+15874369605">Call (587) 436-9605</a><a className="text-cyan underline" href="mailto:teamwowclean@gmail.com">Email WOW CLEAN</a></div>
        <Link className="inline-block text-sm text-mid hover:text-cyan" href="/book">Book another detail →</Link>
      </div>
    </main>
  );
}
