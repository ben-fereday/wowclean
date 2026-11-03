"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getManagedBooking, requestBookingChange } from "./actions";
import { PACKAGE_LABELS, SERVICE_TYPE_LABELS, VEHICLE_LABELS, type PackageId, type ServiceType, type VehicleSize } from "@/lib/constants";
import { getCalgaryNow, parseBookingTime } from "@/lib/booking-schedule";

type Details = NonNullable<Awaited<ReturnType<typeof getManagedBooking>>>;
const field = "w-full rounded-lg border border-white/20 bg-navy p-3 text-white";
const statusLabels: Record<string, string> = { confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
const money = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);

export default function ManageBooking() {
  const [token, setToken] = useState("");
  const [booking, setBooking] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [kind, setKind] = useState("reschedule");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestError, setRequestError] = useState("");

  useEffect(() => {
    const changed = () => { setBooking(null); setSent(false); setMessage(""); setRequestError(""); setRetry(v => v + 1); };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const access = new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
    setToken(access); setLoading(true); setError("");
    if (!access) { setLoading(false); return; }
    getManagedBooking(access).then(data => { if (!cancelled) { setBooking(data); if (!data) setError("This booking link is invalid or expired."); } })
      .catch(() => { if (!cancelled) setError("We couldn’t load your booking. Please retry or contact us."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry]);

  const now = getCalgaryNow();
  const upcoming = booking && booking.status === "confirmed" && (booking.booking_date > now.date || (booking.booking_date === now.date && (parseBookingTime(booking.booking_time) ?? 0) > now.minutes));
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSending(true); setRequestError("");
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
            <p className="text-xs text-mid">Your final amount is confirmed after the service. Keep this link private; anyone with it can view this appointment. It expires 30 days after the appointment date when issued.</p>
          </section>
          {upcoming && <section className="rounded-2xl border border-white/10 p-6 space-y-4" aria-label="Request a booking change">
            <h2 className="text-xl font-semibold text-white">Need to change something?</h2>
            <p className="text-sm text-mid">Send Ben a request. Your appointment stays as booked until WOW CLEAN confirms the change. For an urgent change, please call.</p>
            {sent ? <p className="rounded-lg border border-cyan/30 bg-cyan/5 p-4 text-cyan" role="status">Your request has been sent. We’ll contact you to confirm. Your appointment has not changed yet.</p> :
              <form onSubmit={submit} className="space-y-4">
                <label className="block space-y-2 text-sm text-mid">Request type<select className={field} value={kind} onChange={e => setKind(e.target.value)}><option value="reschedule">Reschedule appointment</option><option value="cancel">Request cancellation</option><option value="other">Other change</option></select></label>
                <label className="block space-y-2 text-sm text-mid">Details<textarea className={field} required minLength={10} maxLength={1500} rows={4} placeholder="Tell us what you’d like to change. For rescheduling, include your preferred dates and times." value={message} onChange={e => setMessage(e.target.value)} /></label>
                {requestError && <p className="text-sm text-red-400" role="alert">{requestError}</p>}
                <button className="rounded-lg bg-cyan px-5 py-3 font-semibold text-navy disabled:opacity-40" disabled={sending || message.trim().length < 10}>{sending ? "Sending…" : "Send request"}</button>
              </form>}
          </section>}
          {!upcoming && <p className="text-sm text-mid">For questions about this appointment, contact WOW CLEAN below.</p>}
        </>}
        <div className="flex flex-wrap gap-4 text-sm"><a className="text-cyan underline" href="tel:+15874369605">Call (587) 436-9605</a><a className="text-cyan underline" href="mailto:teamwowclean@gmail.com">Email WOW CLEAN</a></div>
        <Link className="inline-block text-sm text-mid hover:text-cyan" href="/book">Book another detail →</Link>
      </div>
    </main>
  );
}
