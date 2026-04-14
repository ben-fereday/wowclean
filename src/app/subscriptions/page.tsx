"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSubscription } from "./actions";
import { getBookedTimesForDate } from "@/lib/availability";
import { isTimeBlocked } from "@/lib/time-utils";
import {
  SUBSCRIPTION_PLANS,
  PACKAGES,
  TIME_SLOTS,
  VEHICLE_LABELS,
  VEHICLE_EXAMPLES,
  PACKAGE_LABELS,
  BILLING_CYCLES,
  SUBSCRIPTION_PRICING,
  applyDiscount,
  type SubscriptionPlan,
  type PackageId,
  type VehicleSize,
  type BillingCycle,
} from "@/lib/constants";
import { fetchSubscriptionPrices, type SubPricingGrid } from "@/lib/pricing-db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarClock,
  Package,
  Car,
  Calendar,
  Clock,
  MapPin,
  Check,
  RefreshCw,
  ArrowRight,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Info,
  Snowflake,
} from "lucide-react";

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-dark" />}>
      <SubscriptionsContent />
    </Suspense>
  );
}

function SubscriptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLDivElement>(null);
  const autoSubmitAttempted = useRef(false);

  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle | null>(null);
  const [pkg, setPkg] = useState<PackageId | null>(null);
  const [vehicleSize, setVehicleSize] = useState<VehicleSize | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  // DB pricing
  const [dbSubPricing, setDbSubPricing] = useState<SubPricingGrid>(
    SUBSCRIPTION_PRICING as unknown as SubPricingGrid
  );

  useEffect(() => {
    fetchSubscriptionPrices().then(setDbSubPricing);
  }, []);

  const [address, setAddress] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColour, setVehicleColour] = useState("");
  const [notes, setNotes] = useState("");

  // Promo code state
  const [promoInput, setPromoInput] = useState("");
  const [promoApplied, setPromoApplied] = useState<{
    code: string;
    discount_pct: number;
  } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Calendar state
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const minStartDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 3);
    return d;
  }, [today]);
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  // Weekly/Biweekly are locked to Standard. Monthly: user picks.
  useEffect(() => {
    if (plan === "weekly" || plan === "biweekly") {
      setPkg("standard");
    } else if (plan === "monthly") {
      // Don't auto-pick — let the user choose
      if (pkg === "exclusive") setPkg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // Fetch booked times when start date changes
  useEffect(() => {
    if (!startDate) {
      setBookedTimes([]);
      return;
    }
    getBookedTimesForDate(startDate).then(setBookedTimes);
  }, [startDate]);

  // Restore from URL params (after login redirect)
  useEffect(() => {
    const p = searchParams.get("plan") as SubscriptionPlan | null;
    const bc = searchParams.get("billing") as BillingCycle | null;
    const pk = searchParams.get("pkg") as PackageId | null;
    const v = searchParams.get("vehicle") as VehicleSize | null;
    const sd = searchParams.get("startDate");
    const t = searchParams.get("time");
    const addr = searchParams.get("address");
    const vm = searchParams.get("make");
    const vmo = searchParams.get("model");
    const vc = searchParams.get("colour");
    const n = searchParams.get("notes");

    if (p) setPlan(p);
    if (bc) setBillingCycle(bc);
    if (pk) setPkg(pk);
    if (v) setVehicleSize(v);
    if (sd) setStartDate(sd);
    if (t) setTimeSlot(t);
    if (addr) setAddress(addr);
    if (vm) setVehicleMake(vm);
    if (vmo) setVehicleModel(vmo);
    if (vc) setVehicleColour(vc);
    if (n) setNotes(n);
  }, [searchParams]);

  async function handleApplyPromo() {
    setPromoError("");
    const code = promoInput.trim();
    if (!code) {
      setPromoError("Enter a code first.");
      return;
    }
    setPromoChecking(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { validatePromoCode } = await import("@/lib/promo-codes");
      const result = await validatePromoCode(
        code,
        "subscription",
        user?.id ?? null
      );
      if (!result.valid || !result.code_text || result.discount_pct == null) {
        setPromoError(result.error || "Invalid code.");
        setPromoApplied(null);
      } else {
        setPromoApplied({
          code: result.code_text,
          discount_pct: result.discount_pct,
        });
      }
    } finally {
      setPromoChecking(false);
    }
  }

  function handleRemovePromo() {
    setPromoApplied(null);
    setPromoInput("");
    setPromoError("");
  }

  function handleSubscribe() {
    submitSubscription(
      plan,
      billingCycle,
      pkg,
      vehicleSize,
      startDate,
      timeSlot,
      address,
      vehicleMake,
      vehicleModel,
      vehicleColour,
      notes
    );
  }

  async function submitSubscription(
    p: SubscriptionPlan | null,
    bc: BillingCycle | null,
    pk: PackageId | null,
    vs: VehicleSize | null,
    sd: string | null,
    ts: string | null,
    addr: string,
    vm: string,
    vmo: string,
    vc: string,
    n: string
  ) {
    setError("");

    if (!p || !bc || !pk || !vs || !sd || !ts) {
      setError("Please complete all selections before subscribing.");
      return;
    }

    if (!addr.trim()) {
      setError("Please enter your service address.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const params = new URLSearchParams();
      params.set("plan", p);
      params.set("billing", bc);
      params.set("pkg", pk);
      params.set("vehicle", vs);
      params.set("startDate", sd);
      params.set("time", ts);
      if (addr) params.set("address", addr);
      if (vm) params.set("make", vm);
      if (vmo) params.set("model", vmo);
      if (vc) params.set("colour", vc);
      if (n) params.set("notes", n);
      const redirectPath = `/subscriptions?${params.toString()}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    const result = await createSubscription({
      plan: p,
      package_id: pk,
      vehicle_size: vs,
      billing_cycle: bc,
      start_date: sd,
      time_slot: ts,
      location: "mobile",
      address: addr.trim(),
      vehicle_make: vm.trim() || undefined,
      vehicle_model: vmo.trim() || undefined,
      vehicle_colour: vc.trim() || undefined,
      notes: n.trim() || undefined,
      promo_code: promoApplied?.code ?? null,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      window.scrollTo(0, 0);
      setTimeout(() => router.push("/account"), 2000);
    }
  }

  // Auto-submit after redirect from login
  useEffect(() => {
    if (autoSubmitAttempted.current) return;
    const p = searchParams.get("plan") as SubscriptionPlan | null;
    const bc = searchParams.get("billing") as BillingCycle | null;
    const pk = searchParams.get("pkg") as PackageId | null;
    const v = searchParams.get("vehicle") as VehicleSize | null;
    const sd = searchParams.get("startDate");
    const t = searchParams.get("time");
    const addr = searchParams.get("address") || "";
    const vm = searchParams.get("make") || "";
    const vmo = searchParams.get("model") || "";
    const vc = searchParams.get("colour") || "";
    const n = searchParams.get("notes") || "";

    if (p && bc && pk && v && sd && t && addr) {
      autoSubmitAttempted.current = true;
      setTimeout(() => {
        submitSubscription(p, bc, pk, v, sd, t, addr, vm, vmo, vc, n);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Pricing — subscription-specific rates from DB
  const basePerVisit =
    plan && pkg && vehicleSize
      ? (dbSubPricing?.[plan]?.[pkg]?.[vehicleSize] ?? 0)
      : null;
  // Apply billing cycle discount first (10% off for 3-month prepay)
  const billingDiscounted =
    basePerVisit !== null && billingCycle === "three_month"
      ? applyDiscount(basePerVisit, 10)
      : basePerVisit;
  // Then apply promo discount on top
  const rawPerVisit = billingDiscounted;
  const perVisit =
    rawPerVisit !== null && promoApplied
      ? applyDiscount(rawPerVisit, promoApplied.discount_pct)
      : rawPerVisit;
  const visitsPerMonth = plan === "weekly" ? 4 : plan === "biweekly" ? 2 : 1;
  const monthlyTotal =
    perVisit !== null ? perVisit * visitsPerMonth : null;
  const visitsPerThreeMonths =
    plan === "weekly" ? 12 : plan === "biweekly" ? 6 : 3;
  const threeMonthTotal =
    perVisit !== null ? perVisit * visitsPerThreeMonths : null;

  const visiblePackages = useMemo(() => {
    if (plan === "monthly") {
      return PACKAGES.filter((p) => p.id === "standard" || p.id === "premium");
    }
    return PACKAGES.filter((p) => p.id === "standard");
  }, [plan]);

  // Calendar grid (Mon-first)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startWeekday = (firstDay.getDay() + 6) % 7; // Mon=0
    const days: {
      day: number;
      empty: boolean;
      past: boolean;
      tooSoon: boolean;
      today: boolean;
      date: Date | null;
    }[] = [];

    for (let i = 0; i < startWeekday; i++) {
      days.push({
        day: 0,
        empty: true,
        past: false,
        tooSoon: false,
        today: false,
        date: null,
      });
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(calYear, calMonth, d);
      const past = dt < today;
      const tooSoon = !past && dt < minStartDate;
      const isToday =
        dt.getFullYear() === today.getFullYear() &&
        dt.getMonth() === today.getMonth() &&
        dt.getDate() === today.getDate();
      days.push({
        day: d,
        empty: false,
        past,
        tooSoon,
        today: isToday,
        date: dt,
      });
    }
    return days;
  }, [calYear, calMonth, today, minStartDate]);

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  function changeMonth(delta: number) {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    // Don't allow navigating into past months
    const targetEnd = new Date(y, m + 1, 0);
    if (targetEnd < today) return;
    setCalMonth(m);
    setCalYear(y);
  }

  function isoDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  if (success) {
    return (
      <main className="min-h-screen pt-[72px]">
        <section className="bg-dark py-32 px-6 text-center">
          <div className="max-w-lg mx-auto">
            <div className="w-20 h-20 rounded-full bg-blue/20 flex items-center justify-center mx-auto mb-8">
              <Check className="w-10 h-10 text-cyan" />
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl tracking-wider text-white mb-4">
              You&apos;re <span className="text-cyan">Subscribed!</span>
            </h1>
            <p className="text-mid leading-relaxed mb-8">
              Your {plan} {pkg && PACKAGE_LABELS[pkg]} subscription has been
              created. Your first visit is on{" "}
              {startDate
                ? new Date(startDate + "T12:00:00").toLocaleDateString(
                    "en-US",
                    { month: "long", day: "numeric", year: "numeric" }
                  )
                : "soon"}{" "}
              at {timeSlot}.
            </p>
            <Button
              onClick={() => router.push("/account")}
              className="bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-lg font-bold tracking-wider uppercase px-8 py-4 rounded-lg shadow-[0_0_40px_rgba(26,74,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] transition-all"
            >
              View My Account
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen pt-[72px]">
      {/* ── Hero ── */}
      <section className="bg-dark py-20 px-6 text-center">
        <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-cyan mb-4">
          Recurring Detail Plans
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-7xl tracking-wider text-white mb-4">
          Subscription <span className="text-cyan">Plans</span>
        </h1>
        <p className="text-mid max-w-2xl mx-auto leading-relaxed">
          Keep your vehicle looking its best with a recurring detail plan.
          Choose weekly, bi-weekly, or monthly service and save time.
        </p>
      </section>

      {/* ── Plan Cards ── */}
      <section className="bg-navy py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {SUBSCRIPTION_PLANS.map((p) => (
              <Card
                key={p.id}
                className="relative bg-dark/50 border-white/[0.08] hover:border-cyan/40 transition-all group"
              >
                <CardContent className="p-8 text-center">
                  <Badge
                    className={`mb-6 ${
                      p.id === "weekly"
                        ? "bg-yellow/20 text-yellow border-yellow/30"
                        : p.id === "biweekly"
                        ? "bg-blue/20 text-cyan border-cyan/30"
                        : "bg-white/10 text-silver border-white/20"
                    }`}
                  >
                    {p.discount}
                  </Badge>
                  <div className="w-14 h-14 rounded-xl bg-blue/20 flex items-center justify-center mx-auto mb-4">
                    <RefreshCw className="w-6 h-6 text-cyan" />
                  </div>
                  <h3 className="font-[family-name:var(--font-heading)] text-3xl tracking-wider text-white mb-2">
                    {p.name}
                  </h3>
                  <p className="text-mid text-sm leading-relaxed mb-4">
                    {p.desc}
                  </p>
                  <p className="text-xs text-mid/60 italic">
                    Pay monthly or save 10% by paying every 3 months
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button
              onClick={scrollToForm}
              className="bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-lg font-bold tracking-wider uppercase px-10 py-5 rounded-lg shadow-[0_0_40px_rgba(26,74,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] transition-all"
            >
              Build Your Plan
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Signup Form ── */}
      <section ref={formRef} className="bg-dark py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-cyan mb-4">
              Build Your Plan
            </p>
            <h2 className="font-[family-name:var(--font-heading)] text-4xl md:text-5xl tracking-wider text-white mb-4">
              Subscribe <span className="text-cyan">Now</span>
            </h2>
          </div>

          {/* Info banners — not a step, just context */}
          <div className="space-y-3 mb-12">
            <div className="bg-dark/50 border border-cyan/20 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-cyan mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-sm font-semibold mb-1">
                  Standard Full Detail, per vehicle
                </p>
                <p className="text-mid text-sm">
                  Every visit is a complete interior &amp; exterior detail.
                  Subscriptions cover one vehicle &mdash; sign up another plan
                  if you have multiple cars.
                </p>
              </div>
            </div>
            <div className="bg-dark/50 border border-yellow/20 rounded-lg p-4 flex items-start gap-3">
              <Snowflake className="w-5 h-5 text-yellow mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-sm font-semibold mb-1">
                  Cold Weather Restriction
                </p>
                <p className="text-mid text-sm">
                  Exterior services may be limited or rescheduled in freezing
                  conditions for safety and quality. We&apos;ll contact you
                  ahead of time if a visit is affected.
                </p>
              </div>
            </div>
            <div className="bg-dark/50 border border-white/[0.08] rounded-lg p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-mid mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-sm font-semibold mb-1">
                  Scheduling Policy
                </p>
                <p className="text-mid text-sm">
                  Your selected slot becomes your recurring appointment time.
                  We understand schedules change &mdash; members can reschedule
                  via text or email with at least 48 hours&apos; notice. Missed
                  details without notice will not receive a credit.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-12">
            {/* Step 1 — Plan */}
            <FormStep number="01" title="Pick Your Plan" icon={CalendarClock}>
              <div className="grid sm:grid-cols-3 gap-4">
                {SUBSCRIPTION_PLANS.map((p) => (
                  <SelectionCard
                    key={p.id}
                    selected={plan === p.id}
                    onClick={() => setPlan(p.id)}
                    badge={p.discount}
                    badgeVariant={
                      p.id === "weekly"
                        ? "yellow"
                        : p.id === "biweekly"
                        ? "cyan"
                        : "silver"
                    }
                  >
                    <h4 className="font-[family-name:var(--font-heading)] text-xl tracking-wider text-white">
                      {p.name}
                    </h4>
                    <p className="text-mid text-sm mt-1">{p.desc}</p>
                  </SelectionCard>
                ))}
              </div>
            </FormStep>

            {/* Step 2 — Billing Cycle */}
            <FormStep number="02" title="Billing Cycle" icon={DollarSign}>
              <div className="grid sm:grid-cols-2 gap-4">
                {BILLING_CYCLES.map((bc) => {
                  const selected = billingCycle === bc.id;
                  return (
                    <button
                      key={bc.id}
                      type="button"
                      onClick={() => setBillingCycle(bc.id)}
                      className={`relative text-left w-full p-6 rounded-xl border transition-all ${
                        selected
                          ? "border-cyan/60 bg-blue/10 shadow-[0_0_20px_rgba(26,74,255,0.15)]"
                          : "border-white/[0.08] bg-dark/50 hover:border-cyan/30"
                      }`}
                    >
                      {selected && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-cyan flex items-center justify-center">
                          <Check className="w-4 h-4 text-dark" />
                        </div>
                      )}
                      {bc.discountPct > 0 && (
                        <div className="inline-block mb-3 px-3 py-1 rounded-full bg-yellow text-dark font-[family-name:var(--font-barlow-condensed)] text-xs font-extrabold tracking-wider uppercase shadow-[0_0_20px_rgba(255,224,102,0.5)]">
                          Save {bc.discountPct}%
                        </div>
                      )}
                      <h4 className="font-[family-name:var(--font-heading)] text-xl tracking-wider text-white">
                        {bc.name}
                      </h4>
                      <p className="text-mid text-sm mt-1">{bc.desc}</p>
                      {bc.id === "three_month" &&
                        basePerVisit !== null && (
                          <p className="text-cyan text-sm mt-3 font-semibold">
                            ${applyDiscount(basePerVisit, 10) * visitsPerThreeMonths}{" "}
                            <span className="text-mid line-through font-normal">
                              ${basePerVisit * visitsPerThreeMonths}
                            </span>{" "}
                            <span className="text-mid font-normal">
                              / 3 months
                            </span>
                          </p>
                        )}
                    </button>
                  );
                })}
              </div>
            </FormStep>

            {/* Package step — only meaningful for monthly. Weekly/biweekly = locked Standard */}
            {plan === "monthly" ? (
              <FormStep number="03" title="Choose Your Package" icon={Package}>
                <div className="grid sm:grid-cols-2 gap-4">
                  {visiblePackages.map((p) => (
                    <SelectionCard
                      key={p.id}
                      selected={pkg === p.id}
                      onClick={() => setPkg(p.id as PackageId)}
                    >
                      <h4 className="font-[family-name:var(--font-heading)] text-xl tracking-wider text-white">
                        {p.name}
                      </h4>
                      <p className="text-mid text-sm mt-1 line-clamp-2">
                        {p.desc}
                      </p>
                    </SelectionCard>
                  ))}
                </div>
              </FormStep>
            ) : plan ? (
              <FormStep number="03" title="Your Package" icon={Package}>
                <div className="bg-dark/50 border border-cyan/30 rounded-xl p-5 max-w-md">
                  <Badge className="mb-3 bg-cyan/20 text-cyan border-cyan/30">
                    Included with {plan === "weekly" ? "Weekly" : "Bi-Weekly"}
                  </Badge>
                  <h4 className="font-[family-name:var(--font-heading)] text-xl tracking-wider text-white">
                    The Standard
                  </h4>
                  <p className="text-mid text-sm mt-1">
                    Full interior &amp; exterior detail every visit.
                  </p>
                </div>
              </FormStep>
            ) : null}

            {/* Step 4 — Vehicle Size */}
            <FormStep number="04" title="Select Vehicle Size" icon={Car}>
              <div className="grid sm:grid-cols-3 gap-4">
                {(
                  Object.entries(VEHICLE_LABELS) as [VehicleSize, string][]
                ).map(([id, label]) => (
                  <SelectionCard
                    key={id}
                    selected={vehicleSize === id}
                    onClick={() => setVehicleSize(id)}
                  >
                    <h4 className="font-[family-name:var(--font-heading)] text-xl tracking-wider text-white">
                      {label}
                    </h4>
                    <p className="text-mid text-sm mt-1">
                      {VEHICLE_EXAMPLES[id]}
                    </p>
                  </SelectionCard>
                ))}
              </div>
            </FormStep>

            {/* Step 5 — Start Date (calendar) */}
            <FormStep
              number="05"
              title="When Should We Start?"
              icon={Calendar}
            >
              <p className="text-mid text-sm mb-4">
                Pick the date of your first visit. Subscriptions must start at
                least 3 days from today, and your service will recur on this
                same date going forward.
              </p>
              <div className="bg-dark/50 border border-white/[0.08] rounded-xl p-5 max-w-md">
                <div className="flex items-center justify-between mb-5">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    className="bg-transparent border border-white/15 text-silver w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all hover:border-cyan hover:text-cyan"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="font-[family-name:var(--font-heading)] text-[1.4rem] tracking-[2px] text-white">
                    {monthLabel.toUpperCase()}
                  </div>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    className="bg-transparent border border-white/15 text-silver w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all hover:border-cyan hover:text-cyan"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                    (d) => (
                      <div
                        key={d}
                        className="font-[family-name:var(--font-barlow-condensed)] text-[0.68rem] font-bold tracking-[2px] uppercase text-mid text-center py-1.5"
                      >
                        {d}
                      </div>
                    )
                  )}
                  {calendarDays.map((cell, idx) => {
                    if (cell.empty)
                      return <div key={`e-${idx}`} className="h-9" />;
                    const disabled = cell.past || cell.tooSoon;
                    const dateIso = cell.date ? isoDate(cell.date) : "";
                    const selected = startDate === dateIso;
                    return (
                      <button
                        key={`d-${cell.day}`}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          if (!disabled && cell.date) {
                            setStartDate(dateIso);
                            setTimeSlot(null);
                          }
                        }}
                        className={`h-9 flex items-center justify-center rounded-md text-[0.82rem] font-medium transition-all border ${
                          disabled
                            ? "text-white/20 cursor-not-allowed border-white/[0.04]"
                            : selected
                            ? "bg-blue border-blue text-white font-bold"
                            : cell.today
                            ? "border-cyan/40 text-cyan cursor-pointer hover:bg-cyan/10"
                            : "border-white/[0.08] cursor-pointer hover:bg-cyan/10 hover:border-cyan/30 text-white"
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>
              {startDate && (
                <p className="mt-3 text-sm text-cyan">
                  First visit:{" "}
                  {new Date(startDate + "T12:00:00").toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    }
                  )}
                </p>
              )}
            </FormStep>

            {/* Step 6 — Time Slot */}
            {startDate && (
              <FormStep number="06" title="Select Recurring Time" icon={Clock}>
                <p className="text-mid text-sm mb-4">
                  Need to change a single visit&apos;s time later? Contact us
                  at{" "}
                  <a
                    href="mailto:teamwowclean@gmail.com"
                    className="text-cyan hover:underline"
                  >
                    teamwowclean@gmail.com
                  </a>{" "}
                  or (587) 891-3265 and we&apos;ll adjust that one
                  appointment.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {TIME_SLOTS.map((slot) => {
                    const blocked = isTimeBlocked(slot, bookedTimes);
                    return (
                      <button
                        key={slot}
                        type="button"
                        disabled={blocked}
                        onClick={() => {
                          if (!blocked) setTimeSlot(slot);
                        }}
                        className={`px-3 py-3 rounded-lg font-[family-name:var(--font-barlow-condensed)] text-sm font-semibold tracking-wider uppercase transition-all border ${
                          blocked
                            ? "bg-dark/30 border-white/[0.04] text-mid/30 cursor-not-allowed opacity-40 line-through"
                            : timeSlot === slot
                            ? "bg-blue border-blue text-white shadow-[0_0_20px_rgba(26,74,255,0.4)]"
                            : "bg-dark/50 border-white/[0.08] text-mid hover:border-cyan/40 hover:text-white"
                        }`}
                      >
                        {slot}
                        {blocked && (
                          <span className="block text-[10px] text-red-400/60 mt-0.5 no-underline font-normal normal-case">
                            Booked
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {TIME_SLOTS.every((s) => isTimeBlocked(s, bookedTimes)) && (
                  <p className="mt-3 text-sm text-red-400">
                    This day is fully booked. Please pick a different start
                    date.
                  </p>
                )}
              </FormStep>
            )}

            {/* Step 7 — Address & Vehicle Details */}
            <FormStep
              number="07"
              title="Address &amp; Vehicle"
              icon={MapPin}
            >
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                <div className="sm:col-span-2">
                  <Label htmlFor="address" className="text-white mb-2 block">
                    Service Address *
                  </Label>
                  <Input
                    id="address"
                    type="text"
                    placeholder="123 Main St, Calgary, AB"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div>
                  <Label htmlFor="make" className="text-white mb-2 block">
                    Vehicle Make
                  </Label>
                  <Input
                    id="make"
                    type="text"
                    placeholder="e.g. Toyota"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div>
                  <Label htmlFor="model" className="text-white mb-2 block">
                    Model &amp; Year
                  </Label>
                  <Input
                    id="model"
                    type="text"
                    placeholder="e.g. RAV4 2021"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="colour" className="text-white mb-2 block">
                    Colour
                  </Label>
                  <Input
                    id="colour"
                    type="text"
                    placeholder="e.g. Pearl White"
                    value={vehicleColour}
                    onChange={(e) => setVehicleColour(e.target.value)}
                    className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="notes" className="text-white mb-2 block">
                    Notes (Optional)
                  </Label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Pet hair, heavy staining, access instructions, gate codes..."
                    rows={4}
                    className="w-full bg-[hsl(var(--background))] border border-[hsl(var(--muted-foreground))]/30 rounded-md px-3 py-2 text-white text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:border-cyan resize-y min-h-[100px]"
                  />
                </div>
              </div>
            </FormStep>

            {/* ── Price Display & Submit ── */}
            <div className="bg-dark/50 border border-white/[0.08] rounded-2xl p-8 space-y-6">
              {/* Promo Code */}
              <div>
                <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-mid mb-2">
                  Promo Code
                </p>
                {promoApplied ? (
                  <div className="flex items-center justify-between gap-3 bg-cyan/[0.08] border border-cyan/30 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Check className="w-4 h-4 text-cyan" />
                      <div>
                        <p className="text-cyan font-[family-name:var(--font-barlow-condensed)] tracking-wider uppercase text-sm font-bold">
                          {promoApplied.code} applied
                        </p>
                        <p className="text-mid text-xs">
                          {promoApplied.discount_pct}% off every visit
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePromo}
                      className="text-mid hover:text-white text-xs font-semibold uppercase tracking-wider transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={promoInput}
                      onChange={(e) => {
                        setPromoInput(e.target.value);
                        if (promoError) setPromoError("");
                      }}
                      placeholder="Enter code"
                      className="flex-1 border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))] uppercase tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPromo}
                      disabled={promoChecking || !promoInput.trim()}
                      className="bg-cyan/[0.12] border border-cyan/30 text-cyan hover:bg-cyan/[0.2] hover:text-white font-[family-name:var(--font-barlow-condensed)] text-sm font-bold tracking-wider uppercase px-5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {promoChecking ? "..." : "Apply"}
                    </button>
                  </div>
                )}
                {promoError && (
                  <p className="text-red-400 text-xs mt-2">{promoError}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-blue/20 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-cyan" />
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-mid mb-1">
                      Per Visit
                    </p>
                    <p className="font-[family-name:var(--font-heading)] text-4xl tracking-wider text-white">
                      {perVisit !== null ? (
                        <>
                          {(billingCycle === "three_month" || promoApplied) && basePerVisit !== null && basePerVisit !== perVisit && (
                            <span className="text-mid line-through text-2xl mr-2">
                              ${basePerVisit}
                            </span>
                          )}
                          <span className="text-cyan">${perVisit}</span>
                        </>
                      ) : (
                        <span className="text-mid/40">---</span>
                      )}
                    </p>
                    {monthlyTotal !== null && (
                      <p className="text-xs text-mid mt-1">
                        ${monthlyTotal}/month
                      </p>
                    )}
                    {billingCycle === "three_month" &&
                      threeMonthTotal !== null && (
                        <p className="text-xs text-yellow mt-1 font-semibold">
                          ${threeMonthTotal} every 3 months (10% off)
                        </p>
                      )}
                    {promoApplied && (
                      <p className="text-xs text-cyan mt-1 font-semibold">
                        {promoApplied.discount_pct}% off applied per visit
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-lg font-bold tracking-wider uppercase px-10 py-5 rounded-lg shadow-[0_0_40px_rgba(26,74,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Subscribe"}
                  {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
                </Button>
              </div>

              {error && (
                <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ── Helper Components ── */

function FormStep({
  number,
  title,
  icon: Icon,
  children,
}: {
  number: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-blue/20 flex items-center justify-center">
          <Icon className="w-5 h-5 text-cyan" />
        </div>
        <div>
          <p className="font-[family-name:var(--font-heading)] text-cyan text-xs tracking-wider">
            Step {number}
          </p>
          <h3 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white">
            {title}
          </h3>
        </div>
      </div>
      {children}
    </div>
  );
}

function SelectionCard({
  selected,
  onClick,
  badge,
  badgeVariant,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  badge?: string;
  badgeVariant?: "yellow" | "cyan" | "silver";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left w-full p-5 rounded-xl border transition-all ${
        selected
          ? "border-cyan/60 bg-blue/10 shadow-[0_0_20px_rgba(26,74,255,0.15)]"
          : "border-white/[0.08] bg-dark/50 hover:border-cyan/30"
      }`}
    >
      {selected && (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-cyan flex items-center justify-center">
          <Check className="w-4 h-4 text-dark" />
        </div>
      )}
      {badge && (
        <Badge
          className={`mb-3 text-[10px] ${
            badgeVariant === "yellow"
              ? "bg-yellow/20 text-yellow border-yellow/30"
              : badgeVariant === "cyan"
              ? "bg-blue/20 text-cyan border-cyan/30"
              : "bg-white/10 text-silver border-white/20"
          }`}
        >
          {badge}
        </Badge>
      )}
      {children}
    </button>
  );
}
