"use client";

import { useEffect, useMemo, useState } from "react";
import { getAppointmentHistoryPage } from "./history-actions";
import { getCalgaryNow } from "@/lib/booking-schedule";
import { PACKAGE_LABELS, SERVICE_TYPE_LABELS } from "@/lib/constants";
import { filterAppointmentHistory, historyName as nameOf, type Booking, type HistoryPayment as Payment } from "@/lib/admin-history";

const field = "w-full rounded-lg border border-white/20 bg-[#0b1740] p-2.5 text-sm text-white [color-scheme:dark]";
const labels: Record<string, string> = { confirmed: "Awaiting completion", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" };
const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const dateLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-CA", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });

export default function AppointmentHistory({ onOpen, refreshKey }: { onOpen: (booking: Booking, name: string) => void; refreshKey: number }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [payment, setPayment] = useState("all");
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => getCalgaryNow());

  useEffect(() => {
    const timer = setInterval(() => setNow(getCalgaryNow()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    async function load() {
      const all: Booking[] = [];
      const details: Payment[] = [];
      for (let offset = 0; ; offset += 200) {
        const result = await getAppointmentHistoryPage(offset);
        if (cancelled) return;
        all.push(...result.bookings); details.push(...result.payments);
        if (!result.hasMore) break;
      }
      if (!cancelled) { setBookings(all); setPayments(details); setNow(getCalgaryNow()); }
    }
    load().catch(() => { if (!cancelled) setError("Could not load appointment history. Please retry."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retry, refreshKey, now.date]);

  const paymentMap = useMemo(() => new Map(payments.map(p => [p.booking_id, p])), [payments]);
  const invalidRange = range === "custom" && !!from && !!to && from > to;
  const filtered = useMemo(() => {
    return filterAppointmentHistory(bookings, paymentMap, { search, range, from, to, status, payment }, now);
  }, [bookings, paymentMap, search, range, from, to, status, payment, now, invalidRange]);
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages - 1);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#070d22] p-4 sm:p-6 space-y-5" aria-label="Appointment history">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-[family-name:var(--font-heading)] text-2xl uppercase text-white">Appointment History</h2>
          <p className="text-sm text-mid mt-1">Past appointments, newest first. All dates and times are Calgary time.</p>
          <p className="text-xs text-mid mt-1">Past confirmed appointments stay awaiting completion until you update their status.</p></div>
        <button className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40" disabled={loading} onClick={() => setRetry(v => v + 1)}>Refresh</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm text-mid space-y-1">Search
          <input className={field} type="search" placeholder="Customer, reference, email or phone" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label>
        <label className="text-sm text-mid space-y-1">Date range
          <select className={field} value={range} onChange={e => { setRange(e.target.value); setPage(0); }}>
            <option value="all">All past appointments</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="custom">Custom range</option>
          </select></label>
        <label className="text-sm text-mid space-y-1">Appointment status
          <select className={field} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
            <option value="all">All statuses</option>{Object.entries(labels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select></label>
        <label className="text-sm text-mid space-y-1">Payment status
          <select className={field} value={payment} onChange={e => { setPayment(e.target.value); setPage(0); }}>
            <option value="all">All payments</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>
          </select></label>
      </div>
      {range === "custom" && <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-mid space-y-1">From<input className={field} type="date" value={from} max={to || now.date} onChange={e => { setFrom(e.target.value); setPage(0); }} /></label>
        <label className="text-sm text-mid space-y-1">To<input className={field} type="date" value={to} min={from} max={now.date} onChange={e => { setTo(e.target.value); setPage(0); }} /></label>
      </div>}
      {invalidRange && <p className="text-sm text-red-400" role="alert">The end date must be on or after the start date.</p>}
      {loading ? <p className="text-sm text-mid" role="status">Loading appointment history…</p> : error ? <p className="text-sm text-red-400" role="alert">{error} <button className="underline" onClick={() => setRetry(v => v + 1)}>Retry</button></p> : <>
        <p className="text-xs text-mid" role="status">{filtered.length} appointment{filtered.length === 1 ? "" : "s"} found</p>
        {!filtered.length ? <p className="py-8 text-center text-mid">No past appointments match these filters.</p> :
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-sm text-left">
              <thead className="text-mid"><tr>{["Date & time", "Customer", "Service", "Status", "Payment", "Amount (CAD)", ""].map(h => <th key={h} className="px-3 py-3 font-medium" scope="col">{h || <span className="sr-only">Details</span>}</th>)}</tr></thead>
              <tbody>{filtered.slice(currentPage * 25, currentPage * 25 + 25).map(b => {
                const p = paymentMap.get(b.id);
                return <tr key={b.id} className="border-t border-white/10 text-white hover:bg-white/5">
                  <td className="px-3 py-4 whitespace-nowrap">{dateLabel(b.booking_date)}<div className="text-xs text-mid mt-1">{b.booking_time}</div></td>
                  <td className="px-3 py-4">{nameOf(b)}<div className="text-xs text-mid mt-1">{b.reference_code}</div></td>
                  <td className="px-3 py-4">{PACKAGE_LABELS[b.package]}<div className="text-xs text-mid mt-1">{SERVICE_TYPE_LABELS[b.service_type]}</div></td>
                  <td className={`px-3 py-4 ${b.status === "completed" ? "text-green-400" : b.status === "confirmed" ? "text-yellow" : "text-mid"}`}>{labels[b.status] ?? b.status}</td>
                  <td className={`px-3 py-4 ${p?.payment_status === "paid" ? "text-green-400" : "text-yellow"}`}>{p?.payment_status === "paid" ? "Paid" : "Unpaid"}</td>
                  <td className="px-3 py-4 whitespace-nowrap">{money.format(p?.final_amount ?? b.total_estimate)}<div className="text-xs text-mid mt-1">{p?.final_amount == null ? "Estimate" : "Final amount"}</div></td>
                  <td className="px-3 py-4"><button className="rounded-lg border border-cyan/40 px-3 py-2 text-cyan whitespace-nowrap focus-visible:outline-2 focus-visible:outline-cyan" aria-label={`View appointment for ${nameOf(b)} on ${dateLabel(b.booking_date)}`} onClick={() => onOpen(b, nameOf(b))}>View details</button></td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
        {pages > 1 && <div className="flex items-center justify-between gap-3 text-sm text-mid">
          <button className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-40" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage + 1} of {pages}</span>
          <button className="rounded-lg border border-white/20 px-3 py-2 disabled:opacity-40" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button>
        </div>}
      </>}
    </section>
  );
}
