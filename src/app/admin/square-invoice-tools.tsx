"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createSquareInvoice, getSquareInvoice, previewSquareInvoice, refreshSquareInvoice, sendSquareInvoice } from "./square-actions";
import type { InvoicePreview, InvoiceRecord } from "@/lib/square-model";
const button = "rounded-lg bg-blue px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed";
const cash = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
export default function SquareInvoiceTools({ bookingId, finalAmount, onStatusChange }: { bookingId: string; finalAmount: string; onStatusChange: () => void }) {
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null);
  const [preview, setPreview] = useState<{ preview: InvoicePreview; fingerprint: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [webhook, setWebhook] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    getSquareInvoice(bookingId).then(r => {
      if (cancelled) return;
      setConfigured(r.configured); setWebhook(r.webhookConfigured); setInvoice(r.invoice);
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load Square invoice."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bookingId, retry]);
  useEffect(() => { setPreview(null); setReviewed(false); }, [finalAmount, bookingId]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch(e) { const message = e instanceof Error ? e.message : "Square request failed. Please retry."; setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  return (
    <section className="space-y-3 border-t border-white/10 pt-5" aria-label="Square invoices">
      <h3 className="text-base font-semibold text-white">Square invoice</h3>
      <p className="text-xs text-mid">Preview uses your Square package, vehicle size and add-ons. The final amount above overrides the catalog total, including any discount. No taxes are added by the website; items with configured taxes require review in Square.</p>
      {loading ? <p className="text-sm text-mid" role="status">Loading invoice…</p> : !configured ? <p className="text-sm text-yellow">Square is not configured for this environment.</p> : (
        <>
          {!webhook && <p className="text-sm text-yellow">Automatic payment updates are awaiting Square webhook setup. Use Refresh payment status to check manually.</p>}
          {invoice ? (
            <div className="space-y-3 rounded-lg border border-white/15 p-4">
              <p className="text-sm text-white">Status: <strong>{invoice.status.replaceAll("_", " ")}</strong></p>
              <p className="text-sm text-silver">Recipient: {invoice.recipient_email}<br />Total: {cash(invoice.total_cents)}<br />Due: {invoice.snapshot.dueDate}</p>
              {invoice.status === "CREATING" && <p className="text-xs text-yellow">An invoice attempt is saved. Resume uses its original price and recipient to prevent duplicates.</p>}
              {invoice.status.includes("REFUND") && <p className="text-sm text-yellow">A refund was recorded in Square. Review the payment record below.</p>}
              <ul className="space-y-1 text-sm text-silver">{invoice.snapshot.lines.map((line, i) => <li key={i}>{line.name}: {cash(line.cents)}</li>)}</ul>
              <p className="text-xs text-mid">Itemization is the website’s original snapshot. If you edited the invoice in Square, review it there before sending.</p>
              {!invoice.invoice_id ? <button className={button} disabled={busy} onClick={() => run(async () => { setInvoice(await createSquareInvoice(bookingId, "", "")); toast.success("Draft invoice created. No email sent."); })}>Resume draft creation</button> : (
                <>
                  {invoice.status === "DRAFT" && <>
                    <label className="flex items-start gap-2 text-sm text-silver"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I have reviewed the recipient, final total and due date and want Square to email this invoice.</label>
                    <button className={button} disabled={busy || !reviewed} onClick={() => run(async () => { setInvoice(await sendSquareInvoice(bookingId, invoice.version, invoice.total_cents, invoice.recipient_email)); setReviewed(false); toast.success("Invoice published in Square for email delivery."); })}>Send invoice to customer</button>
                  </>}
                  <button className={button + " ml-0 sm:ml-2"} disabled={busy} onClick={() => run(async () => { setInvoice(await refreshSquareInvoice(bookingId)); setReviewed(false); onStatusChange(); toast.success("Square payment status refreshed."); })}>Refresh payment status</button>
                </>
              )}
              {invoice.public_url && <a className="block text-sm text-cyan underline" href={invoice.public_url} target="_blank" rel="noopener noreferrer">Open customer payment page</a>}
              <a className="block text-sm text-cyan underline" href="https://app.squareup.com/dashboard/invoices" target="_blank" rel="noopener noreferrer">Manage invoices in Square</a>
              <p className="text-xs text-mid">Website booking cancellation does not cancel a Square invoice or refund a payment. Manage those actions in Square.</p>
            </div>
          ) : (
            <>
              <button className={button} disabled={busy} onClick={() => run(async () => { setPreview(await previewSquareInvoice(bookingId, finalAmount)); })}>Preview Square invoice</button>
              {preview && <div className="space-y-3 rounded-lg border border-white/15 p-4 text-sm text-silver">
                <p>Recipient: {preview.preview.email}<br />Due: {preview.preview.dueDate}</p>
                <ul>{preview.preview.lines.map((line, i) => <li key={i}>{line.name}: {cash(line.cents)}</li>)}</ul>
                <p className="font-semibold text-white">Final total: {cash(preview.preview.total)}</p>
                <button className={button} disabled={busy} onClick={() => run(async () => { setInvoice(await createSquareInvoice(bookingId, finalAmount, preview.fingerprint)); setPreview(null); toast.success("Draft created in Square. No customer email sent."); })}>Create draft in Square</button>
              </div>}
            </>
          )}
        </>
      )}
      {busy && <p role="status" className="text-xs text-mid">Working with Square…</p>}
      {error && <p role="alert" className="text-sm text-red-400">{error} <button className="underline" disabled={busy} onClick={() => setRetry(v => v + 1)}>Reload invoice details</button></p>}
    </section>
  );
}
