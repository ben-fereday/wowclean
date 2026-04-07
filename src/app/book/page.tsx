"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Zap,
  Lock,
  CalendarDays,
  RefreshCw,
  Phone,
  Printer,
  Car,
  CarFront,
  Truck,
  Armchair,
  Sparkles,
  Gem,
  Repeat,
} from "lucide-react";
import {
  PRICING,
  PACKAGES,
  ADDONS,
  EXCLUSIVE_INCLUDED,
  VEHICLE_LABELS,
  VEHICLE_EXAMPLES,
  SERVICE_TYPE_LABELS,
  PACKAGE_LABELS,
  TIME_SLOTS,
  getPrice,
  type VehicleSize,
  type ServiceType,
  type PackageId,
  type LocationType,
} from "@/lib/constants";
import { createBooking, type BookingPayload } from "./actions";
import { getBookedTimesForDate } from "@/lib/availability";
import { isTimeBlocked } from "@/lib/time-utils";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───
type AddonSelection = { id: string; name: string; price: number };

const VEHICLE_ICONS: Record<VehicleSize, React.ReactNode> = {
  small: <Car className="size-10 text-cyan" />,
  medium: <CarFront className="size-10 text-cyan" />,
  large: <Truck className="size-10 text-cyan" />,
};

const SERVICE_TYPE_ICON_MAP: Record<ServiceType, React.ReactNode> = {
  interior: <Armchair className="size-6 text-cyan" />,
  exterior: <Sparkles className="size-6 text-cyan" />,
  full: <Gem className="size-6 text-cyan" />,
};

const STEP_LABELS = ["Vehicle", "Package", "Add-Ons", "Schedule", "Details"];

function SubscriptionCta() {
  return (
    <div className="mt-6 pt-5 border-t border-white/[0.06]">
      <Link
        href="/subscriptions"
        className="flex items-center justify-between gap-3 bg-white/[0.03] border border-cyan/15 rounded-lg px-4 py-3 group hover:bg-cyan/[0.05] hover:border-cyan/25 transition-all"
      >
        <div className="flex items-center gap-3">
          <Repeat className="size-4 text-cyan/70 group-hover:text-cyan transition-colors" />
          <span className="text-[0.85rem] text-mid group-hover:text-silver transition-colors">
            Want recurring service? <span className="text-cyan/80 font-semibold">Check out our subscription plans</span>
          </span>
        </div>
        <ArrowRight className="size-3.5 text-mid/50 group-hover:text-cyan transition-colors" />
      </Link>
    </div>
  );
}

// ─── Component ───
export default function BookPage() {
  // Wizard state
  const [step, setStep] = useState(1);
  const [vehicleSize, setVehicleSize] = useState<VehicleSize | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType>("full");
  const [packageId, setPackageId] = useState<PackageId | null>(null);
  const [addons, setAddons] = useState<AddonSelection[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const location: LocationType = packageId === "exclusive" ? "shop" : "mobile";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleColour, setVehicleColour] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

  // Booked times for selected date
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // Auto-fill from logged-in user profile
  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone, address")
        .eq("id", user.id)
        .single();
      if (profile) {
        if (profile.first_name) setFirstName(profile.first_name);
        if (profile.last_name) setLastName(profile.last_name);
        if (profile.phone) setPhone(profile.phone);
        if (profile.address) setAddress(profile.address);
      }
      if (user.email) setEmail(user.email);
    }
    loadProfile();
  }, []);

  // Fetch booked times when date changes
  useEffect(() => {
    if (!selectedDate) { setBookedTimes([]); return; }
    const isoDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    getBookedTimesForDate(isoDate).then(setBookedTimes);
  }, [selectedDate]);

  // ─── Derived values ───
  const basePrice = useMemo(() => {
    if (!vehicleSize || !packageId) return 0;
    return getPrice(packageId, vehicleSize, serviceType);
  }, [vehicleSize, serviceType, packageId]);

  const addonsTotal = useMemo(
    () =>
      addons
        .filter(
          (a) =>
            !(packageId === "exclusive" && EXCLUSIVE_INCLUDED.includes(a.id))
        )
        .reduce((s, a) => s + a.price, 0),
    [addons, packageId]
  );

  const estimatedTotal = basePrice + addonsTotal;

  const packageData = useMemo(
    () => PACKAGES.find((p) => p.id === packageId),
    [packageId]
  );

  // ─── Handlers ───
  const goToStep = useCallback(
    (n: number) => {
      // When switching away from exclusive and going back, reset addons that are exclusive-only
      if (n < step) {
        // Allow going back freely
      }
      setStep(n);
      window.scrollTo(0, 0);
    },
    [step]
  );

  const toggleAddon = useCallback(
    (addon: (typeof ADDONS)[number]) => {
      if (packageId === "exclusive" && EXCLUSIVE_INCLUDED.includes(addon.id))
        return;
      setAddons((prev) => {
        const exists = prev.find((a) => a.id === addon.id);
        if (exists) return prev.filter((a) => a.id !== addon.id);
        return [...prev, { id: addon.id, name: addon.name, price: addon.price }];
      });
    },
    [packageId]
  );

  const changeMonth = useCallback(
    (dir: number) => {
      let m = calMonth + dir;
      let y = calYear;
      if (m < 0) {
        m = 11;
        y--;
      }
      if (m > 11) {
        m = 0;
        y++;
      }
      // Don't go before current month
      const nowMonth = now.getMonth();
      const nowYear = now.getFullYear();
      if (y < nowYear || (y === nowYear && m < nowMonth)) return;
      setCalMonth(m);
      setCalYear(y);
    },
    [calMonth, calYear, now]
  );

  const validateStep5 = useCallback(() => {
    const errors: Record<string, boolean> = {};
    if (!firstName.trim()) errors.firstName = true;
    if (!lastName.trim()) errors.lastName = true;
    if (!phone.trim()) errors.phone = true;
    if (!email.trim() || !email.includes("@")) errors.email = true;
    if (location === "mobile" && !address.trim()) errors.address = true;
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [firstName, lastName, phone, email, address, location]);

  const handleSubmit = useCallback(async () => {
    if (!validateStep5()) return;
    if (!vehicleSize || !packageId || !selectedDate || !selectedTime) return;

    setSubmitting(true);

    // ISO date for DB storage
    const isoDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

    const payload: BookingPayload = {
      vehicleSize,
      serviceType,
      packageId,
      packageName: PACKAGE_LABELS[packageId],
      addons,
      date: isoDate,
      time: selectedTime,
      location,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      vehicleMake: vehicleMake.trim(),
      vehicleModel: vehicleModel.trim(),
      vehicleColour: vehicleColour.trim(),
      notes: notes.trim(),
      basePrice,
      addonsTotal,
      estimatedTotal,
    };

    try {
      const result = await createBooking(payload);
      if (result.success && result.refCode) {
        setRefCode(result.refCode);
        setStep(6);
        window.scrollTo(0, 0);
      } else {
        alert(result.error || "Something went wrong. Please try again.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    validateStep5,
    vehicleSize,
    serviceType,
    packageId,
    addons,
    selectedDate,
    selectedTime,
    location,
    firstName,
    lastName,
    phone,
    email,
    address,
    vehicleMake,
    vehicleModel,
    vehicleColour,
    notes,
    basePrice,
    addonsTotal,
    estimatedTotal,
  ]);

  // ─── Calendar helpers ───
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    // Monday = 0 index
    let startDow = firstDay.getDay(); // 0=Sun
    // Shift so Mon=0, Sun=6
    startDow = startDow === 0 ? 6 : startDow - 1;

    const days: {
      day: number;
      empty: boolean;
      past: boolean;
      sunday: boolean;
      today: boolean;
      date: Date | null;
    }[] = [];

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      days.push({
        day: 0,
        empty: true,
        past: false,
        sunday: false,
        today: false,
        date: null,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(calYear, calMonth, d);
      const isPast = dt < today;
      const isSunday = dt.getDay() === 0;
      const isToday =
        dt.getFullYear() === today.getFullYear() &&
        dt.getMonth() === today.getMonth() &&
        dt.getDate() === today.getDate();
      days.push({
        day: d,
        empty: false,
        past: isPast,
        sunday: isSunday,
        today: isToday,
        date: dt,
      });
    }
    return days;
  }, [calYear, calMonth]);

  const monthLabel = new Date(calYear, calMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isDateSelected = (dt: Date | null) => {
    if (!dt || !selectedDate) return false;
    return (
      dt.getFullYear() === selectedDate.getFullYear() &&
      dt.getMonth() === selectedDate.getMonth() &&
      dt.getDate() === selectedDate.getDate()
    );
  };

  // ─── Summary formatted values ───
  const summaryDatetime = useMemo(() => {
    if (!selectedDate) return null;
    const dateStr = selectedDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    return selectedTime ? `${dateStr} at ${selectedTime}` : dateStr;
  }, [selectedDate, selectedTime]);

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div className="min-h-screen bg-dark">
      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 md:px-12 h-[72px] bg-navy border-b-2 border-blue2 shadow-[0_4px_40px_rgba(0,0,0,0.5)]">
        <Link
          href="/"
          className="font-[family-name:var(--font-heading)] text-[1.55rem] tracking-[2px] text-white no-underline"
        >
          <span className="text-cyan">WOW</span> CLEAN
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-silver font-[family-name:var(--font-barlow-condensed)] text-[0.9rem] font-semibold tracking-[1.5px] uppercase no-underline hover:text-cyan transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Site
        </Link>
      </nav>

      {/* ── LAYOUT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] min-h-screen pt-[72px]">
        {/* ── LEFT: MAIN ── */}
        <main className="relative px-5 md:px-16 py-10 md:py-14">
          {/* Border line on right */}
          <div className="hidden lg:block absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/[0.08] to-transparent" />

          {/* ── Progress Bar ── */}
          {step <= 5 && (
            <div className="flex items-center gap-0 mb-10 md:mb-14">
              {STEP_LABELS.map((label, i) => {
                const num = i + 1;
                const isDone = step > num;
                const isActive = step === num;
                return (
                  <div key={num} className="contents">
                    <div
                      className={`flex items-center gap-2 md:gap-3 font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase transition-colors ${
                        isDone
                          ? "text-cyan"
                          : isActive
                            ? "text-white"
                            : "text-mid"
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-[family-name:var(--font-heading)] text-[1rem] shrink-0 transition-all ${
                          isDone
                            ? "bg-cyan border-cyan text-navy"
                            : isActive
                              ? "bg-blue border-blue text-white"
                              : "border-current"
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          num
                        )}
                      </div>
                      <span className="hidden md:block">{label}</span>
                    </div>
                    {num < 5 && (
                      <div
                        className={`flex-1 h-px mx-2 md:mx-3 min-w-[24px] ${
                          isDone ? "bg-cyan" : "bg-white/10"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ STEP 1: Vehicle ═══ */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-350">
              <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[3px] uppercase text-cyan mb-3">
                Step 1 of 5
              </p>
              <h1 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3rem)] tracking-[2px] text-white mb-2">
                What&apos;s Your <span className="text-cyan">Vehicle?</span>
              </h1>
              <p className="text-[0.95rem] text-mid mb-10 leading-relaxed">
                Select your vehicle size so we can show you accurate pricing for
                your detail.
              </p>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {(["small", "medium", "large"] as VehicleSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setVehicleSize(size)}
                    className={`relative bg-white/[0.04] border-2 rounded-[14px] px-4 py-7 text-center cursor-pointer transition-all overflow-hidden ${
                      vehicleSize === size
                        ? "border-cyan bg-cyan/[0.08]"
                        : "border-white/[0.08] hover:border-cyan/30 hover:bg-cyan/[0.04]"
                    }`}
                  >
                    {vehicleSize === size && (
                      <div className="absolute top-2.5 right-3 w-[22px] h-[22px] bg-cyan text-navy rounded-full flex items-center justify-center text-[0.75rem] font-extrabold animate-in zoom-in duration-300">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="flex justify-center mb-3">
                      {VEHICLE_ICONS[size]}
                    </div>
                    <div className="font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-extrabold tracking-[1px] uppercase text-white mb-1">
                      {VEHICLE_LABELS[size].replace(" Vehicle", "")}
                    </div>
                    <div className="text-[0.78rem] text-mid leading-relaxed">
                      {VEHICLE_EXAMPLES[size].replace(/, /g, " \u00B7 ")}
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between mt-8">
                <div />
                <button
                  onClick={() => vehicleSize && goToStep(2)}
                  disabled={!vehicleSize}
                  className="inline-flex items-center gap-2.5 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-bold tracking-[1px] uppercase px-10 py-4 rounded-lg border-none cursor-pointer shadow-[0_0_40px_rgba(26,74,255,0.4)] transition-all hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 relative overflow-hidden group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-[2500ms]" />
                  Next: Choose Package <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <SubscriptionCta />
            </div>
          )}

          {/* ═══ STEP 2: Package ═══ */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-350">
              <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[3px] uppercase text-cyan mb-3">
                Step 2 of 5
              </p>
              <h1 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3rem)] tracking-[2px] text-white mb-2">
                Choose Your <span className="text-cyan">Package</span>
              </h1>
              <p className="text-[0.95rem] text-mid mb-10 leading-relaxed">
                Select what you&apos;d like detailed, then pick the package that
                fits your needs.
              </p>

              {/* Service type selector */}
              <div className="grid grid-cols-3 gap-3.5 mb-10">
                {(["interior", "exterior", "full"] as ServiceType[]).map(
                  (st) => (
                    <button
                      key={st}
                      onClick={() => setServiceType(st)}
                      className={`bg-white/[0.04] border-2 rounded-xl px-4 py-5 text-center cursor-pointer transition-all ${
                        serviceType === st
                          ? "border-cyan bg-cyan/[0.08]"
                          : "border-white/[0.08] hover:border-cyan/30"
                      }`}
                    >
                      <div className="flex justify-center mb-2">
                        {SERVICE_TYPE_ICON_MAP[st]}
                      </div>
                      <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.95rem] font-bold tracking-[1px] uppercase text-white">
                        {SERVICE_TYPE_LABELS[st]}
                      </div>
                    </button>
                  )
                )}
              </div>

              {/* Package cards */}
              <div className="flex flex-col gap-4 mb-8">
                {PACKAGES.map((pkg) => {
                  const price =
                    vehicleSize
                      ? getPrice(pkg.id, vehicleSize, serviceType)
                      : 0;
                  const selected = packageId === pkg.id;
                  // Get the right features based on service type
                  const features =
                    serviceType === "interior"
                      ? pkg.interiorFeatures
                      : serviceType === "exterior"
                        ? pkg.exteriorFeatures
                        : pkg.features;

                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setPackageId(pkg.id as PackageId)}
                      className={`relative bg-white/[0.04] border-2 rounded-[14px] px-5 md:px-7 py-6 cursor-pointer transition-all flex items-start gap-5 overflow-hidden text-left ${
                        selected
                          ? "border-cyan bg-cyan/[0.07]"
                          : "border-white/[0.08] hover:border-cyan/25 hover:bg-cyan/[0.03]"
                      }`}
                    >
                      {/* Left accent bar */}
                      <div
                        className={`absolute top-0 left-0 bottom-0 w-[3px] bg-gradient-to-b from-blue to-cyan transition-transform origin-top ${
                          selected
                            ? "scale-y-100"
                            : "scale-y-0 group-hover:scale-y-100"
                        }`}
                      />
                      {/* Radio */}
                      <div
                        className={`w-[22px] h-[22px] rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                          selected
                            ? "border-cyan bg-cyan"
                            : "border-mid"
                        }`}
                      >
                        {selected && (
                          <div className="w-2 h-2 rounded-full bg-navy" />
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-[family-name:var(--font-barlow-condensed)] text-[1.3rem] font-extrabold tracking-[1px] uppercase text-white mb-1">
                          {pkg.name}
                        </div>
                        <div className="text-[0.85rem] text-mid leading-relaxed mb-2.5">
                          {pkg.desc}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {features.map((f) => (
                            <span
                              key={f}
                              className="bg-white/[0.06] border border-white/10 rounded px-2 py-0.5 text-[0.72rem] text-silver font-[family-name:var(--font-barlow-condensed)] tracking-[0.5px]"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                        {pkg.shopOnly && (
                          <span className="inline-block mt-1.5 bg-yellow-500/[0.12] border border-yellow-500/30 text-[#ffe066] font-[family-name:var(--font-barlow-condensed)] text-[0.7rem] font-bold tracking-[1.5px] uppercase px-2 py-0.5 rounded">
                            In-Shop Only
                          </span>
                        )}
                      </div>
                      {/* Price */}
                      <div className="font-[family-name:var(--font-heading)] text-[2rem] text-cyan tracking-[1px] text-right whitespace-nowrap">
                        ${price}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-8 gap-4">
                <button
                  onClick={() => goToStep(1)}
                  className="inline-flex items-center gap-2 bg-transparent border border-white/15 text-mid font-[family-name:var(--font-barlow-condensed)] text-[1rem] font-semibold tracking-[1px] uppercase px-6 py-3.5 rounded-lg cursor-pointer transition-all hover:border-white/30 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => packageId && goToStep(3)}
                  disabled={!packageId}
                  className="inline-flex items-center gap-2.5 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-bold tracking-[1px] uppercase px-10 py-4 rounded-lg border-none cursor-pointer shadow-[0_0_40px_rgba(26,74,255,0.4)] transition-all hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 relative overflow-hidden group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-[2500ms]" />
                  Next: Add-Ons <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <SubscriptionCta />
            </div>
          )}

          {/* ═══ STEP 3: Add-Ons ═══ */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-350">
              <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[3px] uppercase text-cyan mb-3">
                Step 3 of 5
              </p>
              <h1 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3rem)] tracking-[2px] text-white mb-2">
                Customize Your <span className="text-cyan">Detail</span>
              </h1>
              <p className="text-[0.95rem] text-mid mb-10 leading-relaxed">
                Enhance your service with optional add-ons. All prices are
                flat-rate additions to your package.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
                {ADDONS.map((addon) => {
                  const isExclusiveIncluded =
                    packageId === "exclusive" &&
                    EXCLUSIVE_INCLUDED.includes(addon.id);
                  const isSelected =
                    isExclusiveIncluded ||
                    addons.some((a) => a.id === addon.id);

                  return (
                    <button
                      key={addon.id}
                      onClick={() => toggleAddon(addon)}
                      disabled={isExclusiveIncluded}
                      className={`flex items-center justify-between gap-3 bg-white/[0.04] border-2 rounded-[10px] px-4 py-3.5 cursor-pointer transition-all text-left ${
                        isExclusiveIncluded
                          ? "opacity-40 cursor-not-allowed border-white/[0.07]"
                          : isSelected
                            ? "border-cyan bg-cyan/[0.06]"
                            : "border-white/[0.07] hover:border-cyan/25"
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded shrink-0 border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-cyan border-cyan text-navy"
                              : "border-mid"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.9rem] font-bold tracking-[0.5px] text-white">
                          {addon.name}
                          {isExclusiveIncluded && (
                            <span className="text-cyan/70 ml-1.5 text-[0.8rem] font-normal">
                              (included)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-[family-name:var(--font-heading)] text-[1.1rem] text-cyan tracking-[0.5px] whitespace-nowrap">
                        {isExclusiveIncluded ? "—" : `+$${addon.price}`}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-8 gap-4">
                <button
                  onClick={() => goToStep(2)}
                  className="inline-flex items-center gap-2 bg-transparent border border-white/15 text-mid font-[family-name:var(--font-barlow-condensed)] text-[1rem] font-semibold tracking-[1px] uppercase px-6 py-3.5 rounded-lg cursor-pointer transition-all hover:border-white/30 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => goToStep(4)}
                  className="inline-flex items-center gap-2.5 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-bold tracking-[1px] uppercase px-10 py-4 rounded-lg border-none cursor-pointer shadow-[0_0_40px_rgba(26,74,255,0.4)] transition-all hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] relative overflow-hidden group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-[2500ms]" />
                  Next: Pick a Time <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <SubscriptionCta />
            </div>
          )}

          {/* ═══ STEP 4: Date & Time ═══ */}
          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-350">
              <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[3px] uppercase text-cyan mb-3">
                Step 4 of 5
              </p>
              <h1 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3rem)] tracking-[2px] text-white mb-2">
                Pick Your{" "}
                <span className="text-cyan">Date &amp; Time</span>
              </h1>
              <p className="text-[0.95rem] text-mid mb-10 leading-relaxed">
                Choose a date and arrival window that works for you. Same-day
                bookings available when slots are open.
              </p>

              {/* Calendar */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-5">
                  <button
                    onClick={() => changeMonth(-1)}
                    className="bg-transparent border border-white/15 text-silver w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all hover:border-cyan hover:text-cyan"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="font-[family-name:var(--font-heading)] text-[1.6rem] tracking-[2px] text-white">
                    {monthLabel.toUpperCase()}
                  </div>
                  <button
                    onClick={() => changeMonth(1)}
                    className="bg-transparent border border-white/15 text-silver w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center transition-all hover:border-cyan hover:text-cyan"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {/* Day labels - Mon to Sun */}
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

                  {/* Day cells */}
                  {calendarDays.map((cell, idx) => {
                    if (cell.empty)
                      return <div key={`empty-${idx}`} className="h-9" />;

                    const disabled = cell.past || cell.sunday;
                    const selected = isDateSelected(cell.date);

                    return (
                      <button
                        key={`day-${cell.day}`}
                        disabled={disabled}
                        onClick={() => {
                          if (!disabled && cell.date) {
                            setSelectedDate(cell.date);
                            setSelectedTime(null);
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

              {/* Time slots */}
              {selectedDate && (
                <div className="mb-8">
                  <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[3px] uppercase text-cyan mb-3.5">
                    Available Times
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5">
                    {TIME_SLOTS.map((slot) => {
                      const blocked = isTimeBlocked(slot, bookedTimes);
                      return (
                        <button
                          key={slot}
                          onClick={() => !blocked && setSelectedTime(slot)}
                          disabled={blocked}
                          className={`bg-white/[0.04] border rounded-lg px-2 py-3 text-center font-[family-name:var(--font-barlow-condensed)] text-[0.9rem] font-bold tracking-[0.5px] transition-all ${
                            blocked
                              ? "border-white/[0.04] text-mid/30 cursor-not-allowed opacity-40 line-through"
                              : selectedTime === slot
                              ? "bg-blue border-blue text-white cursor-pointer"
                              : "border-white/[0.08] text-silver hover:border-cyan/30 hover:text-white cursor-pointer"
                          }`}
                        >
                          {slot}
                          {blocked && <span className="block text-[10px] text-red-400/60 mt-0.5 no-underline">Booked</span>}
                        </button>
                      );
                    })}
                  </div>
                  {bookedTimes.length > 0 && TIME_SLOTS.every((s) => isTimeBlocked(s, bookedTimes)) && (
                    <p className="mt-3 text-sm text-red-400">This day is fully booked. Please select a different date.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between mt-8 gap-4">
                <button
                  onClick={() => goToStep(3)}
                  className="inline-flex items-center gap-2 bg-transparent border border-white/15 text-mid font-[family-name:var(--font-barlow-condensed)] text-[1rem] font-semibold tracking-[1px] uppercase px-6 py-3.5 rounded-lg cursor-pointer transition-all hover:border-white/30 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() =>
                    selectedDate && selectedTime && goToStep(5)
                  }
                  disabled={!selectedDate || !selectedTime}
                  className="inline-flex items-center gap-2.5 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-bold tracking-[1px] uppercase px-10 py-4 rounded-lg border-none cursor-pointer shadow-[0_0_40px_rgba(26,74,255,0.4)] transition-all hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 relative overflow-hidden group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-[2500ms]" />
                  Next: Your Details <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <SubscriptionCta />
            </div>
          )}

          {/* ═══ STEP 5: Contact Details ═══ */}
          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-350">
              <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[3px] uppercase text-cyan mb-3">
                Step 5 of 5
              </p>
              <h1 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3rem)] tracking-[2px] text-white mb-2">
                Your <span className="text-cyan">Details</span>
              </h1>
              <p className="text-[0.95rem] text-mid mb-10 leading-relaxed">
                Almost done! Tell us a bit about you and your vehicle so we can
                prepare for your detail.
              </p>

              {/* Location info */}
              <div className={`rounded-lg border p-4 mb-6 ${packageId === "exclusive" ? "border-white/[0.08] bg-white/[0.04]" : "border-cyan/20 bg-cyan/[0.04]"}`}>
                {packageId === "exclusive" ? (
                  <>
                    <p className="text-white font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-sm font-semibold mb-1">In-Shop Service</p>
                    <p className="text-mid text-sm">Exclusive Detail is performed in-shop only. We&apos;ll contact you with the shop location.</p>
                  </>
                ) : (
                  <>
                    <p className="text-cyan font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-sm font-semibold mb-1">Mobile Service — We Come to You</p>
                    <p className="text-mid text-sm">Standard and Supreme packages are mobile services.</p>
                  </>
                )}
              </div>

              {/* Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* First Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className={`bg-white/5 border rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid ${
                      formErrors.firstName
                        ? "border-red-500"
                        : "border-white/[0.12] focus:border-cyan"
                    }`}
                  />
                </div>

                {/* Last Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                    className={`bg-white/5 border rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid ${
                      formErrors.lastName
                        ? "border-red-500"
                        : "border-white/[0.12] focus:border-cyan"
                    }`}
                  />
                </div>

                {/* Phone */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(403) 555-0100"
                    className={`bg-white/5 border rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid ${
                      formErrors.phone
                        ? "border-red-500"
                        : "border-white/[0.12] focus:border-cyan"
                    }`}
                  />
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@email.com"
                    className={`bg-white/5 border rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid ${
                      formErrors.email
                        ? "border-red-500"
                        : "border-white/[0.12] focus:border-cyan"
                    }`}
                  />
                </div>

                {/* Address (mobile only) */}
                {location === "mobile" && (
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                      Service Address *
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="123 Main St, Calgary, AB"
                      className={`bg-white/5 border rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid ${
                        formErrors.address
                          ? "border-red-500"
                          : "border-white/[0.12] focus:border-cyan"
                      }`}
                    />
                  </div>
                )}

                {/* Vehicle Make */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                    Vehicle Make
                  </label>
                  <input
                    type="text"
                    value={vehicleMake}
                    onChange={(e) => setVehicleMake(e.target.value)}
                    placeholder="e.g. Toyota"
                    className="bg-white/5 border border-white/[0.12] rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid focus:border-cyan"
                  />
                </div>

                {/* Vehicle Model */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                    Vehicle Model & Year
                  </label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="e.g. RAV4 2021"
                    className="bg-white/5 border border-white/[0.12] rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid focus:border-cyan"
                  />
                </div>

                {/* Colour */}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                    Colour
                  </label>
                  <input
                    type="text"
                    value={vehicleColour}
                    onChange={(e) => setVehicleColour(e.target.value)}
                    placeholder="e.g. Pearl White"
                    className="bg-white/5 border border-white/[0.12] rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid focus:border-cyan"
                  />
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-[0.78rem] font-bold tracking-[2px] uppercase text-mid">
                    Anything We Should Know?
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Pet hair, heavy staining, specific areas of concern, access instructions..."
                    rows={4}
                    className="bg-white/5 border border-white/[0.12] rounded-lg px-4 py-3 text-white text-[0.95rem] outline-none transition-colors placeholder:text-mid focus:border-cyan resize-y min-h-[100px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-8 gap-4">
                <button
                  onClick={() => goToStep(4)}
                  className="inline-flex items-center gap-2 bg-transparent border border-white/15 text-mid font-[family-name:var(--font-barlow-condensed)] text-[1rem] font-semibold tracking-[1px] uppercase px-6 py-3.5 rounded-lg cursor-pointer transition-all hover:border-white/30 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2.5 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-bold tracking-[1px] uppercase px-10 py-4 rounded-lg border-none cursor-pointer shadow-[0_0_40px_rgba(26,74,255,0.4)] transition-all hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 relative overflow-hidden group"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[200%] transition-transform duration-[2500ms]" />
                  {submitting ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" /> Confirm Booking
                    </>
                  )}
                </button>
              </div>
              <SubscriptionCta />
            </div>
          )}

          {/* ═══ STEP 6: Confirmation ═══ */}
          {step === 6 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-10">
              {/* Icon */}
              <div className="w-[90px] h-[90px] bg-gradient-to-br from-blue2 to-blue rounded-full flex items-center justify-center text-[2.5rem] mx-auto mb-7 shadow-[0_0_60px_rgba(26,74,255,0.5)] animate-in zoom-in duration-500">
                <Check className="w-10 h-10 text-white" />
              </div>

              <h1 className="font-[family-name:var(--font-heading)] text-[clamp(2.5rem,5vw,4rem)] tracking-[2px] text-white mb-3">
                You&apos;re All <span className="text-cyan">Booked!</span>
              </h1>
              <p className="text-[1rem] text-mid leading-relaxed max-w-[480px] mx-auto mb-10">
                Your detail is confirmed. We&apos;ll send a confirmation to your
                email and follow up with a reminder 24 hours before your
                appointment.
              </p>

              {/* Summary card */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-6 md:px-8 py-7 max-w-[500px] mx-auto mb-8 text-left">
                {[
                  { label: "Reference", value: refCode || "—" },
                  { label: "Name", value: `${firstName} ${lastName}` },
                  {
                    label: "Vehicle",
                    value: vehicleSize
                      ? `${VEHICLE_LABELS[vehicleSize]}${vehicleMake ? ` — ${vehicleMake} ${vehicleModel}` : ""}`
                      : "—",
                  },
                  {
                    label: "Package",
                    value: packageId
                      ? `${PACKAGE_LABELS[packageId]} (${SERVICE_TYPE_LABELS[serviceType]})`
                      : "—",
                  },
                  {
                    label: "Date & Time",
                    value: summaryDatetime || "—",
                  },
                  {
                    label: "Location",
                    value:
                      location === "mobile"
                        ? `Mobile — ${address}`
                        : "In-Shop Drop-Off",
                  },
                  ...(addons.length > 0
                    ? [
                        {
                          label: "Add-Ons",
                          value: addons.map((a) => a.name).join(", "),
                        },
                      ]
                    : []),
                ].map((row, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-baseline py-2 border-b border-white/[0.06] last:border-b-0"
                  >
                    <span className="font-[family-name:var(--font-barlow-condensed)] text-[0.8rem] font-bold tracking-[2px] uppercase text-mid">
                      {row.label}
                    </span>
                    <span className="text-[0.92rem] text-white text-right max-w-[60%]">
                      {row.value}
                    </span>
                  </div>
                ))}
                {/* Total row */}
                <div className="flex justify-between items-baseline pt-3.5 mt-1.5">
                  <span className="font-[family-name:var(--font-barlow-condensed)] text-[0.8rem] font-bold tracking-[2px] uppercase text-mid">
                    Estimated Total
                  </span>
                  <span className="font-[family-name:var(--font-heading)] text-[1.8rem] text-cyan tracking-[1px]">
                    ${estimatedTotal}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3.5 justify-center flex-wrap">
                <a
                  href="tel:14035555555"
                  className="inline-flex items-center gap-2 border border-white/20 text-silver font-[family-name:var(--font-barlow-condensed)] text-[1rem] font-semibold tracking-[1px] uppercase px-7 py-3 rounded-lg transition-all hover:border-cyan hover:text-cyan no-underline"
                >
                  <Phone className="w-4 h-4" /> Call Us
                </a>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 border border-white/20 text-silver font-[family-name:var(--font-barlow-condensed)] text-[1rem] font-semibold tracking-[1px] uppercase px-7 py-3 rounded-lg cursor-pointer transition-all hover:border-cyan hover:text-cyan bg-transparent"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2.5 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-[1rem] font-bold tracking-[1px] uppercase px-7 py-3 rounded-lg no-underline shadow-[0_0_40px_rgba(26,74,255,0.4)] transition-all hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)]"
                >
                  Back to Home <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          )}
        </main>

        {/* ── RIGHT: SUMMARY SIDEBAR ── */}
        <aside className="bg-white/[0.025] border-t lg:border-t-0 lg:border-l border-white/[0.07] px-5 lg:px-9 py-7 lg:py-14 lg:sticky lg:top-[72px] lg:h-[calc(100vh-72px)] lg:overflow-y-auto flex flex-col">
          <div className="font-[family-name:var(--font-heading)] text-[1.6rem] tracking-[2px] text-white mb-8 pb-5 border-b border-white/[0.08]">
            Your Booking
          </div>

          {/* Vehicle */}
          <div className="mb-6">
            <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.68rem] font-bold tracking-[3px] uppercase text-mid mb-2">
              Vehicle Size
            </div>
            <div
              className={`text-[0.92rem] leading-relaxed ${vehicleSize ? "text-white" : "text-white/20 italic"}`}
            >
              {vehicleSize ? VEHICLE_LABELS[vehicleSize] : "Not selected"}
            </div>
          </div>

          {/* Service Type */}
          <div className="mb-6">
            <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.68rem] font-bold tracking-[3px] uppercase text-mid mb-2">
              Service Type
            </div>
            <div className="text-[0.92rem] text-white leading-relaxed">
              {SERVICE_TYPE_LABELS[serviceType]}
            </div>
          </div>

          {/* Package */}
          <div className="mb-6">
            <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.68rem] font-bold tracking-[3px] uppercase text-mid mb-2">
              Package
            </div>
            <div
              className={`text-[0.92rem] leading-relaxed ${packageId ? "text-white" : "text-white/20 italic"}`}
            >
              {packageId ? PACKAGE_LABELS[packageId] : "Not selected"}
            </div>
          </div>

          {/* Add-Ons */}
          {addons.length > 0 && (
            <div className="mb-6">
              <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.68rem] font-bold tracking-[3px] uppercase text-mid mb-2">
                Add-Ons
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {addons.map((a) => {
                  const isIncluded =
                    packageId === "exclusive" &&
                    EXCLUSIVE_INCLUDED.includes(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`flex justify-between text-[0.85rem] ${isIncluded ? "text-mid/50" : "text-silver"}`}
                    >
                      <span>
                        {a.name}
                        {isIncluded && (
                          <span className="text-cyan/50 ml-1 text-[0.75rem]">
                            (included)
                          </span>
                        )}
                      </span>
                      <span
                        className={`font-[family-name:var(--font-heading)] tracking-[0.5px] ${isIncluded ? "text-mid/50 line-through" : "text-cyan"}`}
                      >
                        +${a.price}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="mb-6">
            <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.68rem] font-bold tracking-[3px] uppercase text-mid mb-2">
              Date & Time
            </div>
            <div
              className={`text-[0.92rem] leading-relaxed ${summaryDatetime ? "text-white" : "text-white/20 italic"}`}
            >
              {summaryDatetime || "Not selected"}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-0 border-t border-white/[0.08] my-5" />

          {/* Total */}
          <div className="flex justify-between items-baseline">
            <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.85rem] font-bold tracking-[2px] uppercase text-mid">
              Estimated Total
            </div>
            <div className="font-[family-name:var(--font-heading)] text-[2.4rem] text-cyan tracking-[1px]">
              {estimatedTotal > 0 ? `$${estimatedTotal}` : "\u2014"}
            </div>
          </div>
          <p className="text-[0.78rem] text-mid mt-2 leading-relaxed">
            Final price depends on vehicle condition. Excessively dirty vehicles
            may incur additional charges.
          </p>

          {/* Trust strip */}
          <div className="mt-auto pt-7 border-t border-white/[0.08] flex flex-col gap-2.5">
            {[
              { icon: <Lock className="w-4 h-4" />, text: "Secure booking \u2014 no payment required now" },
              {
                icon: <CalendarDays className="w-4 h-4" />,
                text: "Free rescheduling up to 24 hrs before",
              },
              {
                icon: <RefreshCw className="w-4 h-4" />,
                text: "100% satisfaction guarantee",
              },
              {
                icon: <Phone className="w-4 h-4" />,
                text: "Questions? Call WOW CLEAN",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 text-[0.82rem] text-mid"
              >
                <span className="text-mid shrink-0">{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
