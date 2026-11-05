"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, RotateCcw, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PACKAGE_LABELS } from "@/lib/constants";
import {
  fetchBookingPrices, fetchAddonItems, fetchSubscriptionPrices,
  updateBookingPrice, updateAddonItem, addAddonItem, deleteAddonItem, updateSubscriptionPrice,
  type AllPricing,
} from "@/lib/pricing-db";
import {
  PRICING_PACKAGES, PRICING_SIZES, PRICING_SERVICES, PRICING_SUBSCRIPTIONS,
  addonId, pricingDraft, pricingChanges, savePricingChanges, savedPricingBaseline,
  type PricingDraft, type PricingChange,
} from "@/lib/admin-pricing";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const heading = "font-[family-name:var(--font-heading)]";
const panel = "scroll-mt-28 rounded-2xl border border-white/15 bg-navy/25 p-5 sm:p-7";
const button = "inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-3 text-sm text-mid transition hover:border-cyan/50 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan disabled:cursor-not-allowed disabled:opacity-40";
const saveButton = button + " border-cyan bg-cyan font-semibold text-navy hover:bg-cyan/90 hover:text-navy";
const input = "rounded-lg border border-white/20 bg-navy px-3 py-2 text-sm text-white outline-none focus:border-cyan";
const serviceNames = { interior: "Interior only", exterior: "Exterior only", full: "Full detail" };
const planNames = { weekly: "Weekly", biweekly: "Bi-weekly", monthly: "Monthly" };
const money = (price: number) => `$${price.toLocaleString("en-CA")}`;

function PriceInput({ id, label, value, changed, onChange }: {
  id: string; label: string; value: string; changed: boolean; onChange: (value: string) => void;
}) {
  const invalid = value.trim() === "" || !Number.isSafeInteger(Number(value)) || Number(value) < 0 || Number(value) > 2147483647;
  return <div className="relative"><label htmlFor={id} className="sr-only">{label}</label>
    <div className="flex items-center gap-2"><span aria-hidden="true" className="text-mid">$</span>
      <input id={id} type="number" inputMode="numeric" min="0" max="2147483647" step="1" value={value}
        aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={e => onChange(e.target.value)} className={`${input} w-24 ${invalid ? "border-red-400" : changed ? "border-cyan" : ""}`} />
    </div>{invalid && <p id={`${id}-error`} className="mt-1 max-w-36 text-xs text-red-300">Enter whole dollars, $0 or more.</p>}
  </div>;
}

function describe(change: PricingChange) {
  switch (change.kind) {
    case "booking": return `${PACKAGE_LABELS[change.pkg]} · ${serviceNames[change.service]} · ${change.size}: ${money(change.before)} → ${money(change.price)}`;
    case "subscription": return `${planNames[change.plan]} · ${PACKAGE_LABELS[change.pkg]} · ${change.size}: ${money(change.before)} → ${money(change.price)} per visit`;
    case "addon-create": return `Create ${change.name}: ${money(change.price)}, active`;
    case "addon-delete": return `Delete ${change.name}`;
    case "addon-update": return `${change.name}: ${money(change.before.price)} → ${money(change.price)}; ${change.before.active ? "active" : "inactive"} → ${change.active ? "active" : "inactive"}`;
  }
}

export default function PricingManager() {
  const supabase = useMemo(() => createClient(), []);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [baseline, setBaseline] = useState<AllPricing | null>(null);
  const [draft, setDraft] = useState<PricingDraft | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const reload = useCallback(async () => {
    const [booking, addons, subscription] = await Promise.all([fetchBookingPrices(), fetchAddonItems(), fetchSubscriptionPrices()]);
    const data = { booking, addons, subscription };
    setBaseline(data); setDraft(pricingDraft(data));
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Sign in with an admin account to manage Calgary pricing.");
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (!profile || !["admin", "owner"].includes(profile.role)) throw new Error("You need admin or owner access to manage Calgary pricing.");
        if (cancelled) return;
        setAuthorized(true); await reload();
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : "Could not load pricing. Please reload."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [supabase, reload]);

  const { changes, errors } = baseline && draft ? pricingChanges(baseline, draft) : { changes: [], errors: [] };
  const dirty = !!baseline && !!draft && JSON.stringify(pricingDraft(baseline)) !== JSON.stringify(draft);
  const unsaved = dirty || !!newName || !!newPrice;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  function edit(next: PricingDraft) { setDraft(next); setMessage(""); setError(""); }
  function revert() {
    if (!baseline || savingRef.current) return;
    setDraft(pricingDraft(baseline)); setNewName(""); setNewPrice(""); setMessage("Unsaved edits discarded."); setError("");
  }
  async function save() {
    if (!baseline || !draft || savingRef.current || errors.length || !changes.length) return;
    savingRef.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const { saved, failed } = await savePricingChanges(changes, { updateBookingPrice, updateSubscriptionPrice, updateAddonItem, addAddonItem, deleteAddonItem });
      const next = savedPricingBaseline(baseline, saved);
      setBaseline(next);
      if (failed.length) {
        const deleted = new Set(saved.filter(c => c.kind === "addon-delete").map(c => c.id));
        setDraft({ ...draft, addons: draft.addons.filter(a => !deleted.has(a.id)) });
        setError(`${saved.length} change(s) saved. ${failed.length} could not be saved. Only failed changes remain pending.\n${failed.map(f => `${describe(f.change)}: ${f.error}`).join("\n")}`);
      } else {
        setDraft(pricingDraft(next)); setMessage(`${saved.length} change(s) saved to Calgary pricing.`);
        try { await reload(); } catch { setError("Changes saved, but prices could not be refreshed. Reload to check the latest values."); }
      }
      setConfirmOpen(false);
    } finally { savingRef.current = false; setSaving(false); }
  }

  const deleting = draft?.addons.find(a => a.id === deleteId);
  return <div className="space-y-6">
    <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-4 text-sm leading-relaxed text-mid"><strong className="text-cyan">Calgary live pricing.</strong> Edits stay here until you review and save. Saving changes Calgary&apos;s prices and available add-ons. Existing booking totals are not rewritten.</div>
    {error && <p role="alert" className="whitespace-pre-line rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-cyan/25 p-4 text-sm text-cyan">{message}</p>}
    {loading ? <p role="status" className="text-mid">Loading Calgary pricing…</p> : authorized && baseline && draft ? <>
      <fieldset disabled={saving} className="min-w-0 space-y-6 disabled:opacity-70">
        <section id="booking-prices" className={panel} aria-labelledby="booking-heading">
          <div className="flex items-start gap-3"><SlidersHorizontal className="mt-1 size-5 text-cyan" /><div><h2 id="booking-heading" className={`${heading} text-3xl text-white`}>One-time booking prices</h2><p className="mt-2 text-sm text-mid">The Standard and Premium Detail, by service and vehicle size. Enter whole-dollar prices.</p></div></div>
          <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><caption className="sr-only">Calgary booking prices in CAD</caption><thead><tr className="border-b border-white/20 text-mid"><th scope="col" className="pb-4 pr-5 font-normal">Package / service</th>{PRICING_SIZES.map(size => <th scope="col" key={size} className="pb-4 pl-4 font-normal capitalize">{size}</th>)}</tr></thead><tbody>
            {PRICING_PACKAGES.flatMap(pkg => PRICING_SERVICES.map(service => <tr key={`${pkg}-${service}`} className="border-b border-white/10 last:border-0"><th scope="row" className="py-4 pr-5 font-normal"><span className="font-semibold text-white">{PACKAGE_LABELS[pkg]}</span><span className="mt-1 block text-xs text-mid">{serviceNames[service]}</span></th>{PRICING_SIZES.map(size => <td key={size} className="py-4 pl-4"><PriceInput id={`booking-${pkg}-${size}-${service}`} label={`${PACKAGE_LABELS[pkg]}, ${size}, ${serviceNames[service]}`} value={draft.booking[pkg]?.[size]?.[service] ?? ""} changed={draft.booking[pkg]?.[size]?.[service] !== String(baseline.booking[pkg]?.[size]?.[service])} onChange={value => edit({ ...draft, booking: { ...draft.booking, [pkg]: { ...draft.booking[pkg], [size]: { ...draft.booking[pkg]?.[size], [service]: value } } } })} /></td>)}</tr>))}
          </tbody></table></div>
        </section>
        <section id="addons" className={panel} aria-labelledby="addons-heading">
          <h2 id="addons-heading" className={`${heading} text-3xl text-white`}>Add-ons</h2><p className="mt-2 text-sm leading-relaxed text-mid">Switch an add-on off to stop offering it without deleting it. Prices, toggles, additions and deletions only take effect after Save.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">{draft.addons.map(addon => {
            const original = baseline.addons.find(a => a.id === addon.id);
            return <div key={addon.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${addon.deleted ? "border-red-400/30 bg-red-400/5" : "border-white/10"}`}>
              {addon.deleted ? <><div className="min-w-0 flex-1"><p className="text-sm text-white">{addon.name}</p><p className="mt-1 text-xs text-red-300">Pending deletion — not deleted yet</p></div><button type="button" className={button} onClick={() => edit({ ...draft, addons: draft.addons.map(a => a.id === addon.id ? { ...a, deleted: false } : a) })}>Undo</button></> : <>
                <label className="flex w-full min-w-0 flex-none items-center gap-3 text-sm text-white sm:w-auto sm:flex-1"><input type="checkbox" checked={addon.active} disabled={!original} aria-label={`Activate ${addon.name}`} className="size-4 accent-cyan" onChange={e => edit({ ...draft, addons: draft.addons.map(a => a.id === addon.id ? { ...a, active: e.target.checked } : a) })} /><span className="min-w-0 break-words">{addon.name}<span className="mt-1 block text-xs text-mid">{addon.active ? "Active" : "Inactive"}{!original ? " · Save first to switch off" : ""}</span></span></label>
                <div><p className="mb-1 text-xs text-mid">Starting price</p><PriceInput id={`addon-${addon.id}`} label={`${addon.name} starting price`} value={addon.price} changed={!original || addon.price !== String(original.price)} onChange={value => edit({ ...draft, addons: draft.addons.map(a => a.id === addon.id ? { ...a, price: value } : a) })} /></div>
                <button type="button" aria-label={`Delete ${addon.name}`} title={`Delete ${addon.name}`} onClick={() => setDeleteId(addon.id)} className="rounded-lg border border-red-400/25 p-2 text-red-300 hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-cyan"><Trash2 className="size-4" /></button>
              </>}
            </div>;
          })}</div>
          {!draft.addons.length && <p className="mt-4 text-sm text-mid">No add-ons to show. Create one below.</p>}
          <form className="mt-5 flex flex-wrap items-end gap-4 rounded-xl border border-white/15 bg-dark/40 p-4" onSubmit={e => {
            e.preventDefault(); const name = newName.trim(), id = addonId(name), value = newPrice.trim() === "" ? NaN : Number(newPrice);
            if (!name || !id) { setError("Enter an add-on name containing letters or numbers."); return; }
            if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) { setError("Enter a whole-dollar starting price of $0 or more."); return; }
            if (draft.addons.some(a => a.id === id)) { setError("An add-on with that ID already exists. Choose another name or edit the existing add-on."); return; }
            edit({ ...draft, addons: [...draft.addons, { id, name, price: String(value), active: true, sort_order: Math.max(-1, ...draft.addons.map(a => a.sort_order)) + 1 }] }); setNewName(""); setNewPrice("");
          }}>
            <label className="min-w-40 flex-1 text-sm text-mid">Add-on name<input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="New add-on" className={`${input} mt-2 block w-full`} /></label>
            <label className="text-sm text-mid">Starting price (CAD)<input required type="number" min="0" max="2147483647" step="1" inputMode="numeric" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="0" className={`${input} mt-2 block w-28`} /></label>
            <button type="submit" className={button+" border-cyan/30 text-cyan"}><Plus className="size-4" />Add add-on</button>
          </form>
        </section>
        <section id="subscription-prices" className={panel} aria-labelledby="subscription-heading">
          <h2 id="subscription-heading" className={`${heading} text-3xl text-white`}>Subscription prices</h2><p className="mt-2 text-sm text-mid">Prices are per visit, not per month. Editing prices does not reopen subscription signups.</p>
          <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><caption className="sr-only">Calgary subscription prices per visit in CAD</caption><thead><tr className="border-b border-white/20 text-mid"><th scope="col" className="pb-4 pr-5 font-normal">Plan / package</th>{PRICING_SIZES.map(size => <th scope="col" key={size} className="pb-4 pl-4 font-normal capitalize">{size}</th>)}</tr></thead><tbody>{PRICING_SUBSCRIPTIONS.map(({ plan, pkg }) => <tr key={`${plan}-${pkg}`} className="border-b border-white/10 last:border-0"><th scope="row" className="py-4 pr-5 font-normal"><span className="font-semibold text-white">{planNames[plan]}</span><span className="mt-1 block text-xs text-mid">{PACKAGE_LABELS[pkg]}</span></th>{PRICING_SIZES.map(size => <td key={size} className="py-4 pl-4"><PriceInput id={`sub-${plan}-${pkg}-${size}`} label={`${planNames[plan]}, ${PACKAGE_LABELS[pkg]}, ${size}, per visit`} value={draft.subscription[plan]?.[pkg]?.[size] ?? ""} changed={draft.subscription[plan]?.[pkg]?.[size] !== String(baseline.subscription[plan]?.[pkg]?.[size])} onChange={value => edit({ ...draft, subscription: { ...draft.subscription, [plan]: { ...draft.subscription[plan], [pkg]: { ...draft.subscription[plan]?.[pkg], [size]: value } } } })} /></td>)}</tr>)}</tbody></table></div>
        </section>
      </fieldset>
      {errors.length > 0 && <div role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-300"><p>Fix these fields before saving:</p><ul className="mt-2 list-inside list-disc">{errors.map(text => <li key={text}>{text}</li>)}</ul></div>}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/20 bg-dark/95 p-4 shadow-xl backdrop-blur">
        <button type="button" onClick={revert} disabled={saving || !unsaved} className={button}><RotateCcw className="size-4" />Revert unsaved edits</button><p role="status" className="text-sm text-mid">{changes.length ? `${changes.length} unsaved change(s)` : "No pending changes"}</p><button type="button" onClick={() => setConfirmOpen(true)} disabled={saving || !changes.length || !!errors.length} className={saveButton}><Save className="size-4" />{saving ? "Saving…" : "Save Calgary pricing"}</button>
        {(newName || newPrice) && <p className="w-full text-xs text-yellow">Your new add-on form is not queued yet. Select Add add-on to include it in Save.</p>}
      </div>
      <Dialog open={confirmOpen} onOpenChange={open => { if (!saving) setConfirmOpen(open); }}><DialogContent className="max-h-[85vh] overflow-y-auto border-white/20 bg-dark text-white"><DialogHeader><DialogTitle className={`${heading} text-3xl`}>Review Calgary changes</DialogTitle><DialogDescription className="text-mid">These changes affect live Calgary pricing. Add-on deletions cannot be undone after saving. Changes save individually; any failure will be listed.</DialogDescription></DialogHeader><ul className="space-y-3 text-sm">{changes.map(change => <li key={change.key} className={`rounded-lg border p-3 ${change.kind === "addon-delete" ? "border-red-400/30 text-red-300" : "border-white/15 text-silver"}`}>{describe(change)}</li>)}</ul><div className="mt-4 flex justify-end gap-3"><button type="button" disabled={saving} onClick={() => setConfirmOpen(false)} className={button}>Keep editing</button><button type="button" disabled={saving || !!errors.length} onClick={save} className={saveButton}>{saving ? "Saving…" : "Confirm and save"}</button></div></DialogContent></Dialog>
      <ConfirmModal open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }} title="Remove add-on?" description={`Mark “${deleting?.name ?? "this add-on"}” for deletion? Nothing is deleted until you review and save. Switching it off keeps it available for later.`} confirmLabel="Mark for deletion" variant="destructive" onConfirm={() => {
        edit({ ...draft, addons: baseline.addons.some(a => a.id === deleteId) ? draft.addons.map(a => a.id === deleteId ? { ...a, deleted: true } : a) : draft.addons.filter(a => a.id !== deleteId) }); setDeleteId(null);
      }} />
    </> : null}
  </div>;
}
