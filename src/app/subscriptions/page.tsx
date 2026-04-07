"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createSubscription } from "./actions";
import { getBookedTimesForDay } from "@/lib/availability";
import { isTimeBlocked } from "@/lib/time-utils";
import {
  SUBSCRIPTION_PLANS,
  PACKAGES,
  DAYS_OF_WEEK,
  TIME_SLOTS,
  VEHICLE_LABELS,
  VEHICLE_EXAMPLES,
  SERVICE_TYPE_LABELS,
  PACKAGE_LABELS,
  getPrice,
  type SubscriptionPlan,
  type PackageId,
  type ServiceType,
  type VehicleSize,
  type LocationType,
} from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CalendarClock,
  Package,
  Sparkles,
  Car,
  Calendar,
  Clock,
  MapPin,
  Check,
  RefreshCw,
  ArrowRight,
  DollarSign,
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
  const [pkg, setPkg] = useState<PackageId | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [vehicleSize, setVehicleSize] = useState<VehicleSize | null>(null);
  const [recurringDay, setRecurringDay] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string | null>(null);
  // location is derived from package (standard/supreme = mobile, exclusive = shop)
  const [address, setAddress] = useState("");
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fetch booked times when recurring day changes
  useEffect(() => {
    if (!recurringDay) { setBookedTimes([]); return; }
    getBookedTimesForDay(recurringDay).then(setBookedTimes);
  }, [recurringDay]);

  // Restore selections from URL params (after login redirect)
  useEffect(() => {
    const p = searchParams.get("plan") as SubscriptionPlan | null;
    const pk = searchParams.get("pkg") as PackageId | null;
    const s = searchParams.get("service") as ServiceType | null;
    const v = searchParams.get("vehicle") as VehicleSize | null;
    const d = searchParams.get("day");
    const t = searchParams.get("time");
    const loc = searchParams.get("location") as LocationType | null;
    const addr = searchParams.get("address");
    const sd = searchParams.get("startDate");

    if (p) setPlan(p);
    if (pk) setPkg(pk);
    if (s) setServiceType(s);
    if (v) setVehicleSize(v);
    if (d) setRecurringDay(d);
    if (t) setTimeSlot(t);
    // location is derived from pkg, no need to restore
    if (addr) setAddress(addr);
    if (sd) setStartDate(sd);
  }, [searchParams]);

  // Subscribe handler for manual button clicks
  function handleSubscribe() {
    const p = plan;
    const pk = pkg;
    const st = serviceType;
    const vs = vehicleSize;
    const rd = recurringDay;
    const ts = timeSlot;
    const loc: LocationType = pk === "exclusive" ? "shop" : "mobile";
    const addr = address;
    const sd = startDate;

    submitSubscription(p, pk, st, vs, rd, ts, loc, addr, sd);
  }

  async function submitSubscription(
    p: SubscriptionPlan | null,
    pk: PackageId | null,
    st: ServiceType | null,
    vs: VehicleSize | null,
    rd: string | null,
    ts: string | null,
    loc: LocationType,
    addr: string,
    sd?: string | null
  ) {
    setError("");

    if (!p || !pk || !st || !vs || !rd || !ts) {
      setError("Please complete all selections before subscribing.");
      return;
    }

    if (!sd) {
      setError("Please select a start date for your subscription.");
      return;
    }

    if (loc === "mobile" && !addr.trim()) {
      setError("Please enter your service address for mobile detailing.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const params = new URLSearchParams();
      params.set("plan", p);
      params.set("pkg", pk);
      params.set("service", st);
      params.set("vehicle", vs);
      params.set("day", rd);
      params.set("time", ts);
      params.set("location", loc);
      if (addr) params.set("address", addr);
      if (sd) params.set("startDate", sd);
      const redirectPath = `/subscriptions?${params.toString()}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }

    const result = await createSubscription({
      plan: p,
      package_id: pk,
      service_type: st,
      vehicle_size: vs,
      recurring_day: rd,
      time_slot: ts,
      location: loc,
      address: loc === "mobile" ? addr.trim() : undefined,
      start_date: sd,
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

  // Auto-submit after redirect from login (runs once)
  useEffect(() => {
    if (autoSubmitAttempted.current) return;
    const p = searchParams.get("plan") as SubscriptionPlan | null;
    const pk = searchParams.get("pkg") as PackageId | null;
    const s = searchParams.get("service") as ServiceType | null;
    const v = searchParams.get("vehicle") as VehicleSize | null;
    const d = searchParams.get("day");
    const t = searchParams.get("time");
    const loc = searchParams.get("location") as LocationType | null;
    const addr = searchParams.get("address") || "";
    const sd = searchParams.get("startDate") || null;

    if (p && pk && s && v && d && t && sd) {
      autoSubmitAttempted.current = true;
      setTimeout(() => {
        submitSubscription(p, pk, s, v, d, t, loc || "mobile", addr, sd);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const currentPrice =
    pkg && vehicleSize && serviceType
      ? getPrice(pkg, vehicleSize, serviceType)
      : null;

  // Standard/Supreme = mobile, Exclusive = shop
  const effectiveLocation: LocationType = pkg === "exclusive" ? "shop" : "mobile";

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // Wrapper for the Subscribe button click
  function onSubscribeClick() {
    handleSubscribe();
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
              Your {plan} {PACKAGE_LABELS[pkg!]} subscription has been created.
              We&apos;ll see you every {recurringDay} at {timeSlot}, starting{" "}
              {startDate ? new Date(startDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "soon"}.
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
                    Payments collected in person at each visit
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="bg-dark py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-cyan mb-4">
            Simple Process
          </p>
          <h2 className="font-[family-name:var(--font-heading)] text-4xl md:text-5xl tracking-wider text-white mb-12">
            How It <span className="text-cyan">Works</span>
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                step: "01",
                icon: CalendarClock,
                title: "Choose Frequency",
                desc: "Pick weekly, bi-weekly, or monthly service",
              },
              {
                step: "02",
                icon: Package,
                title: "Customize",
                desc: "Select your package, vehicle size, day & time",
              },
              {
                step: "03",
                icon: Sparkles,
                title: "Create Account",
                desc: "Sign up so we can manage your subscription",
              },
              {
                step: "04",
                icon: Car,
                title: "Enjoy the Shine",
                desc: "We show up on schedule — you just relax",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-14 h-14 rounded-xl bg-blue/20 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-6 h-6 text-cyan" />
                </div>
                <p className="font-[family-name:var(--font-heading)] text-cyan text-sm tracking-wider mb-1">
                  Step {item.step}
                </p>
                <h3 className="font-[family-name:var(--font-heading)] text-xl tracking-wider text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-mid text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <Button
            onClick={scrollToForm}
            className="mt-12 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-lg font-bold tracking-wider uppercase px-10 py-5 rounded-lg shadow-[0_0_40px_rgba(26,74,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] transition-all"
          >
            Get Started
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* ── Signup Form ── */}
      <section ref={formRef} className="bg-navy py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-cyan mb-4">
              Build Your Plan
            </p>
            <h2 className="font-[family-name:var(--font-heading)] text-4xl md:text-5xl tracking-wider text-white mb-4">
              Subscribe <span className="text-cyan">Now</span>
            </h2>
          </div>

          <div className="space-y-12">
            {/* Step 1 — Plan */}
            <FormStep number="01" title="Select Plan" icon={CalendarClock}>
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

            {/* Step 2 — Package */}
            <FormStep number="02" title="Select Package" icon={Package}>
              <div className="grid sm:grid-cols-3 gap-4">
                {PACKAGES.map((p) => (
                  <SelectionCard
                    key={p.id}
                    selected={pkg === p.id}
                    onClick={() => {
                      setPkg(p.id as PackageId);
                    }}
                  >
                    <h4 className="font-[family-name:var(--font-heading)] text-xl tracking-wider text-white">
                      {p.name}
                    </h4>
                    <p className="text-mid text-sm mt-1 line-clamp-2">
                      {p.desc}
                    </p>
                    {p.shopOnly && (
                      <p className="text-yellow text-xs mt-2 font-semibold">
                        In-shop only
                      </p>
                    )}
                  </SelectionCard>
                ))}
              </div>
            </FormStep>

            {/* Step 3 — Service Type */}
            <FormStep number="03" title="Select Service Type" icon={Sparkles}>
              <div className="grid sm:grid-cols-3 gap-4">
                {(
                  Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]
                ).map(([id, label]) => (
                  <SelectionCard
                    key={id}
                    selected={serviceType === id}
                    onClick={() => setServiceType(id)}
                  >
                    <h4 className="font-[family-name:var(--font-heading)] text-xl tracking-wider text-white">
                      {label}
                    </h4>
                  </SelectionCard>
                ))}
              </div>
            </FormStep>

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

            {/* Step 5 — Recurring Day */}
            <FormStep number="05" title="Select Recurring Day" icon={Calendar}>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => { setRecurringDay(day); setStartDate(null); }}
                    className={`px-5 py-3 rounded-lg font-[family-name:var(--font-barlow-condensed)] text-sm font-semibold tracking-wider uppercase transition-all ${
                      recurringDay === day
                        ? "bg-blue text-white shadow-[0_0_20px_rgba(26,74,255,0.4)]"
                        : "bg-dark/50 border border-white/[0.08] text-mid hover:border-cyan/40 hover:text-white"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </FormStep>

            {/* Step 6 — Time Slot */}
            <FormStep number="06" title="Select Time Slot" icon={Clock}>
              <div className="flex flex-wrap gap-3">
                {TIME_SLOTS.map((slot) => {
                  const blocked = isTimeBlocked(slot, bookedTimes);
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={blocked}
                      onClick={() => { if (!blocked) { setTimeSlot(slot); setStartDate(null); } }}
                      className={`px-5 py-3 rounded-lg font-[family-name:var(--font-barlow-condensed)] text-sm font-semibold tracking-wider uppercase transition-all ${
                        blocked
                          ? "bg-dark/30 border border-white/[0.04] text-mid/30 cursor-not-allowed opacity-40 line-through"
                          : timeSlot === slot
                          ? "bg-blue text-white shadow-[0_0_20px_rgba(26,74,255,0.4)]"
                          : "bg-dark/50 border border-white/[0.08] text-mid hover:border-cyan/40 hover:text-white"
                      }`}
                    >
                      {slot}
                      {blocked && <span className="block text-[10px] text-red-400/60 mt-0.5 no-underline font-normal normal-case">Booked</span>}
                    </button>
                  );
                })}
              </div>
              {recurringDay && TIME_SLOTS.every((s) => isTimeBlocked(s, bookedTimes)) && (
                <p className="mt-3 text-sm text-red-400">{recurringDay}s are fully booked. Please select a different day.</p>
              )}
            </FormStep>

            {/* Step 7 — Start Date */}
            {recurringDay && timeSlot && (
              <FormStep number="07" title="When Should We Start?" icon={CalendarClock}>
                <p className="text-mid text-sm mb-4">
                  Pick the {recurringDay} you&apos;d like your first {timeSlot} appointment.
                </p>
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const dayMap: Record<string, number> = {
                      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
                      Thursday: 4, Friday: 5, Saturday: 6,
                    };
                    const target = dayMap[recurringDay];
                    const dates: string[] = [];
                    const today = new Date();
                    // Find next occurrence
                    let daysUntil = target - today.getDay();
                    if (daysUntil <= 0) daysUntil += 7;
                    const first = new Date(today);
                    first.setDate(today.getDate() + daysUntil);
                    // Generate 4 upcoming dates (use local date formatting to avoid UTC shift)
                    for (let i = 0; i < 4; i++) {
                      const d = new Date(first);
                      d.setDate(first.getDate() + i * 7);
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      dates.push(`${yyyy}-${mm}-${dd}`);
                    }
                    return dates.map((dateStr) => {
                      const d = new Date(dateStr + "T12:00:00");
                      const label = d.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => setStartDate(dateStr)}
                          className={`px-5 py-3 rounded-lg font-[family-name:var(--font-barlow-condensed)] text-sm font-semibold tracking-wider uppercase transition-all ${
                            startDate === dateStr
                              ? "bg-blue text-white shadow-[0_0_20px_rgba(26,74,255,0.4)]"
                              : "bg-dark/50 border border-white/[0.08] text-mid hover:border-cyan/40 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    });
                  })()}
                </div>
                {startDate && (
                  <p className="mt-3 text-sm text-cyan">
                    First visit: {new Date(startDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} at {timeSlot}
                  </p>
                )}
              </FormStep>
            )}

            {/* Step 8 — Service Location */}
            <FormStep number="08" title="Service Location" icon={MapPin}>
              {pkg === "exclusive" ? (
                <div className="bg-dark/50 border border-white/[0.08] rounded-lg p-4">
                  <p className="text-white font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-sm font-semibold mb-1">In-Shop Service</p>
                  <p className="text-mid text-sm">
                    Exclusive Detail is performed in-shop only. We&apos;ll contact you with the shop location and details after you subscribe.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="bg-dark/50 border border-cyan/20 rounded-lg p-4 mb-4">
                    <p className="text-cyan font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-sm font-semibold mb-1">Mobile Service — We Come to You</p>
                    <p className="text-mid text-sm">Standard and Supreme packages are mobile services. Enter your address below.</p>
                  </div>
                  <div className="max-w-md">
                    <Label htmlFor="address" className="text-white mb-2 block">
                      Service Address
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
                </div>
              )}
            </FormStep>

            {/* ── Price Display & Submit ── */}
            <div className="bg-dark/50 border border-white/[0.08] rounded-2xl p-8">
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
                      {currentPrice !== null ? (
                        <>
                          <span className="text-cyan">${currentPrice}</span>
                        </>
                      ) : (
                        <span className="text-mid/40">---</span>
                      )}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={onSubscribeClick}
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
