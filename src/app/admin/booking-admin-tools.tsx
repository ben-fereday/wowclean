"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getBookingAdminDetails, saveBookingAdminDetails, getAdminRescheduleTimes, rescheduleBooking } from "./booking-tools-actions";
import { getCalgaryNow } from "@/lib/booking-schedule";
import type { PaymentMethod, PaymentStatus } from "@/lib/admin-booking";

interface Props {
  booking: { id: string; booking_date: string; booking_time: string; status: string; total_estimate: number };
  onRescheduled: () => void | Promise<void>;
}
const fieldClass = "w-full rounded-lg border border-white/20 bg-[#0b1740] p-2.5 text-sm text-white [color-scheme:dark]";
const buttonClass = "rounded-lg bg-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed";

export default function BookingAdminTools({ booking, onRescheduled }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(booking.booking_date);
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [timesLoading, setTimesLoading] = useState(false);
  const [timesError, setTimesError] = useState("");
  const [moving, setMoving] = useState(false);
  const [moveWarning, setMoveWarning] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setLoadError("");
    getBookingAdminDetails(booking.id).then((data) => {
      if (cancelled) return;
      setPaymentStatus(data?.payment_status ?? "unpaid");
      setPaymentMethod(data?.payment_method ?? "");
      setAmount(data?.final_amount == null ? "" : String(data.final_amount));
      setNotes(data?.internal_notes ?? "");
    }).catch(() => { if (!cancelled) setLoadError("Could not load payment details and private notes."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [booking.id, retry]);

  useEffect(() => {
    if (booking.status !== "confirmed" || !date) return;
    let cancelled = false;
    setTime(""); setTimesLoading(true); setTimesError("");
    getAdminRescheduleTimes(booking.id, date).then((times) => { if (!cancelled) setSlots(times); })
      .catch(() => { if (!cancelled) { setSlots([]); setTimesError("Could not check availability. Choose the date again to retry."); } })
      .finally(() => { if (!cancelled) setTimesLoading(false); });
    return () => { cancelled = true; };
  }, [booking.id, booking.status, date]);

  async function save() {
    setSaving(true);
    try {
      const result = await saveBookingAdminDetails(booking.id, { paymentStatus, paymentMethod, finalAmount: amount, notes });
      if (result.error) toast.error(result.error); else toast.success("Payment details and private notes saved.");
    } catch { toast.error("Could not save. Please try again."); }
    finally { setSaving(false); }
  }

  async function move() {
    setMoving(true); setMoveWarning("");
    try {
      const result = await rescheduleBooking(booking.id, date, time, booking.booking_date, booking.booking_time);
      if (result.error) { toast.error(result.error); return; }
      if (result.warning) { setMoveWarning(result.warning); toast.warning(result.warning, { duration: 15000 }); }
      else toast.success("Booking rescheduled. Updated confirmation email sent.");
      await onRescheduled();
    } catch { toast.error("Could not reschedule. Refresh the booking details before retrying."); }
    finally { setMoving(false); }
  }

  return (
    <div className="space-y-5 border-t border-white/10 pt-5">
      <section className="space-y-3" aria-label="Payment and private notes">
        <h3 className="text-base font-semibold text-white">Payment tracking</h3>
        <p className="text-xs text-mid">Manual record only. This does not charge or refund a customer in Square.</p>
        {loading ? <p className="text-sm text-mid" role="status">Loading payment details and notes…</p> : loadError ? (
          <p className="text-sm text-red-400" role="alert">{loadError} <button className="underline" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 text-sm text-mid">Payment status
                <select className={fieldClass} value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}>
                  <option value="unpaid">Unpaid</option><option value="paid">Paid</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-mid">Payment method
                <select className={fieldClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod | "")}>
                  <option value="">Select method</option><option value="credit">Credit card</option><option value="debit">Debit card</option><option value="cash">Cash</option><option value="e_transfer">E-transfer</option>
                </select>
              </label>
              <label className="space-y-1 text-sm text-mid sm:col-span-2">Final amount (CAD)
                <input type="number" min="0" max="999999.99" step="0.01" className={fieldClass} placeholder={`Estimate: $${booking.total_estimate}`} value={amount} onChange={(event) => setAmount(event.target.value)} />
              </label>
            </div>
            <label className="block space-y-1 text-sm text-mid">Private admin notes
              <textarea className={fieldClass} rows={4} maxLength={5000} placeholder="Vehicle condition, access instructions, or follow-up…" value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <p className="text-xs text-mid">Private notes are visible to admins only and are never included in customer emails.</p>
            <button className={buttonClass} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save payment & notes"}</button>
          </>
        )}
      </section>
      {booking.status === "confirmed" && (
        <section className="space-y-3 border-t border-white/10 pt-4" aria-label="Reschedule booking">
          <h3 className="text-base font-semibold text-white">Reschedule booking</h3>
          <p className="text-xs text-mid">Current appointment: {booking.booking_date} at {booking.booking_time}. All times are Calgary time.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1 text-sm text-mid">New date
              <input type="date" className={fieldClass} min={getCalgaryNow().date} value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm text-mid">New start time
              <select className={fieldClass} value={time} disabled={timesLoading || !slots.length} onChange={(event) => setTime(event.target.value)}>
                <option value="">{timesLoading ? "Checking availability…" : "Select a time"}</option>
                {slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </label>
          </div>
          {timesError && <p className="text-sm text-red-400" role="alert">{timesError}</p>}
          {!timesLoading && !timesError && !slots.length && <p className="text-sm text-mid">No available starts on this date.</p>}
          {moveWarning && <p className="text-sm text-yellow" role="alert">{moveWarning}</p>}
          <button className={buttonClass} disabled={moving || !time || timesLoading || !!timesError} onClick={move}>{moving ? "Rescheduling…" : "Reschedule & email customer"}</button>
        </section>
      )}
    </div>
  );
}
