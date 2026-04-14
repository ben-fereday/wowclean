"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getBookedTimesForDay } from "@/lib/availability";
import { isTimeBlocked } from "@/lib/time-utils";
import {
  CalendarDays,
  Clock,
  Car,
  Settings,
  XCircle,
  Sparkles,
  User,
  Mail,
  Phone,
  Pencil,
  Check,
  X,
  MapPin,
  Plus,
  Gift,
} from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  DAYS_OF_WEEK,
  TIME_SLOTS,
  ADDONS,
  EXCLUSIVE_INCLUDED,
  type PackageId,
  type ServiceType,
  type VehicleSize,
  type SubscriptionPlan,
  type BookingStatus,
  type SubscriptionStatus,
} from "@/lib/constants";
import {
  PRICING,
  SUBSCRIPTION_PRICING,
} from "@/lib/constants";
import {
  fetchAllPricing,
  type BookingPricingGrid,
  type SubPricingGrid,
} from "@/lib/pricing-db";
import {
  updateSubscription,
  cancelSubscription,
  updateProfile,
  updateEmail,
  updateBookingAddons,
  signOut,
} from "./actions";

interface BookingAddon {
  id: string;
  name: string;
  price: number;
}

interface Booking {
  id: string;
  booking_date: string;
  booking_time: string;
  package: PackageId;
  service_type: ServiceType;
  vehicle_size: VehicleSize;
  status: BookingStatus;
  reference_code: string;
  total_estimate: number;
  addons: BookingAddon[];
}

interface Subscription {
  id: string;
  plan: SubscriptionPlan;
  package: PackageId;
  service_type: ServiceType;
  vehicle_size: VehicleSize;
  recurring_day: string;
  recurring_time: string;
  status: SubscriptionStatus;
  next_service_date: string;
  location: string;
}

interface Profile {
  first_name: string;
  last_name: string;
  phone?: string;
  address?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_colour?: string;
  referral_code?: string;
  referral_credits?: number;
}

const statusColors: Record<BookingStatus, string> = {
  confirmed: "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/20",
  completed: "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/20",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/20",
  no_show: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20",
};

const statusLabels: Record<BookingStatus, string> = {
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export default function AccountClient({
  email,
  profile,
  bookings,
  subscriptions,
  packageLabels,
  serviceTypeLabels,
  vehicleLabels,
}: {
  email: string;
  profile: Profile | null;
  bookings: Booking[];
  subscriptions: Subscription[];
  packageLabels: Record<PackageId, string>;
  serviceTypeLabels: Record<ServiceType, string>;
  vehicleLabels: Record<VehicleSize, string>;
}) {
  const router = useRouter();

  // DB pricing
  const [dbBooking, setDbBooking] = useState<BookingPricingGrid>(
    PRICING as unknown as BookingPricingGrid
  );
  const [dbSub, setDbSub] = useState<SubPricingGrid>(
    SUBSCRIPTION_PRICING as unknown as SubPricingGrid
  );

  const [dbAddons, setDbAddons] = useState<{ id: string; name: string; price: number; sort_order: number; active: boolean }[]>(
    ADDONS.map((a, i) => ({ id: a.id as string, name: a.name as string, price: a.price as number, sort_order: i, active: true }))
  );

  useEffect(() => {
    fetchAllPricing().then((data) => {
      setDbBooking(data.booking);
      setDbSub(data.subscription);
      setDbAddons(data.addons.filter((a) => a.active));
    });
  }, []);

  function dbGetPrice(pkg: PackageId, vs: VehicleSize, st: ServiceType) {
    return dbBooking?.[pkg]?.[vs]?.[st] ?? 0;
  }

  function dbGetSubPrice(plan: SubscriptionPlan, vs: VehicleSize, pkg: PackageId) {
    return dbSub?.[plan]?.[pkg]?.[vs] ?? 0;
  }

  // Edit subscription modal state
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan>("weekly");
  const [editDay, setEditDay] = useState("Monday");
  const [editTime, setEditTime] = useState("9:00 AM");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editBookedTimes, setEditBookedTimes] = useState<string[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelSub, setConfirmCancelSub] = useState<Subscription | null>(null);

  // Addon edit modal
  const [editingBookingAddons, setEditingBookingAddons] = useState<Booking | null>(null);
  const [editAddons, setEditAddons] = useState<BookingAddon[]>([]);
  const [savingAddons, setSavingAddons] = useState(false);

  // Fetch booked times when edit day changes
  useEffect(() => {
    if (!editDay) return;
    getBookedTimesForDay(editDay).then((times) => {
      // Exclude the current subscription's own time from the blocked list
      if (editingSub) {
        setEditBookedTimes(times.filter((t) => !(t === editingSub.recurring_time && editDay === editingSub.recurring_day)));
      } else {
        setEditBookedTimes(times);
      }
    });
  }, [editDay, editingSub]);

  // Profile edit state
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(profile?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState(email);
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");

  function openEditModal(sub: Subscription) {
    setEditingSub(sub);
    setEditPlan(sub.plan);
    setEditDay(sub.recurring_day);
    setEditTime(sub.recurring_time);
    setEditError("");
  }

  async function handleUpdateSubscription() {
    if (!editingSub) return;
    setEditError("");

    // Check for conflicts
    if (isTimeBlocked(editTime, editBookedTimes)) {
      setEditError(`${editTime} on ${editDay}s conflicts with an existing appointment. Pick a different time or day.`);
      return;
    }

    setSaving(true);
    try {
      await updateSubscription(editingSub.id, {
        plan: editPlan,
        recurring_day: editDay,
        recurring_time: editTime,
      });
      setEditingSub(null);
      router.refresh();
    } catch { /* */ } finally {
      setSaving(false);
    }
  }

  async function handleCancelSubscription() {
    if (!confirmCancelSub) return;
    setCancellingId(confirmCancelSub.id);
    try {
      await cancelSubscription(confirmCancelSub.id);
      setConfirmCancelSub(null);
      router.refresh();
    } catch { /* */ } finally {
      setCancellingId(null);
    }
  }

  function openAddonEditor(booking: Booking) {
    setEditingBookingAddons(booking);
    setEditAddons([...(booking.addons || [])]);
  }

  function toggleAddon(addon: { id: string; name: string; price: number }) {
    if (!editingBookingAddons) return;
    if (editingBookingAddons.package === "exclusive" && EXCLUSIVE_INCLUDED.includes(addon.id)) return;
    setEditAddons((prev) => {
      const exists = prev.find((a) => a.id === addon.id);
      if (exists) return prev.filter((a) => a.id !== addon.id);
      return [...prev, { id: addon.id, name: addon.name, price: addon.price }];
    });
  }

  async function handleSaveAddons() {
    if (!editingBookingAddons) return;
    setSavingAddons(true);
    const basePrice = dbGetPrice(editingBookingAddons.package, editingBookingAddons.vehicle_size, editingBookingAddons.service_type);
    const addonsTotal = editAddons
      .filter((a) => !(editingBookingAddons.package === "exclusive" && EXCLUSIVE_INCLUDED.includes(a.id)))
      .reduce((sum, a) => sum + a.price, 0);
    try {
      await updateBookingAddons(editingBookingAddons.id, editAddons);
      setEditingBookingAddons(null);
      router.refresh();
    } catch { /* */ } finally {
      setSavingAddons(false);
    }
  }

  async function handleSavePhone() {
    setSavingPhone(true);
    try {
      await updateProfile({ phone: phoneValue });
      setEditingPhone(false);
      router.refresh();
    } catch { /* */ } finally {
      setSavingPhone(false);
    }
  }

  async function handleSaveEmail() {
    setSavingEmail(true);
    setEmailMessage("");
    try {
      const result = await updateEmail(emailValue);
      if (result.error) {
        setEmailMessage(result.error);
      } else {
        setEmailMessage(result.message ?? "Check your email to confirm.");
        setEditingEmail(false);
      }
    } catch {
      setEmailMessage("Failed to update email.");
    } finally {
      setSavingEmail(false);
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] px-4 pt-[100px] pb-12">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-[family-name:var(--font-heading)] text-4xl uppercase tracking-wide text-white">
            Welcome back{profile ? `, ${profile.first_name}!` : "!"}
          </h1>
          <p className="mt-1 text-[hsl(var(--muted-foreground))]">Manage your bookings and subscriptions</p>
        </div>

        {/* Account Info */}
        {profile && (
          <>
          <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                <User className="h-5 w-5 text-[hsl(var(--accent))]" />
                Account Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                    <User className="h-3 w-3" /> Name
                  </p>
                  <p className="text-white">{profile.first_name} {profile.last_name}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                    <Mail className="h-3 w-3" /> Email
                  </p>
                  {editingEmail ? (
                    <div className="flex items-center gap-2">
                      <Input type="email" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} className="h-8 border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white text-sm" />
                      <button onClick={handleSaveEmail} disabled={savingEmail} className="text-[hsl(var(--accent))] hover:text-white"><Check className="h-4 w-4" /></button>
                      <button onClick={() => { setEditingEmail(false); setEmailValue(email); setEmailMessage(""); }} className="text-[hsl(var(--muted-foreground))] hover:text-white"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-white">{email}</p>
                      <button onClick={() => setEditingEmail(true)} className="text-[hsl(var(--muted-foreground))] hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  {emailMessage && <p className="mt-1 text-xs text-[hsl(var(--accent))]">{emailMessage}</p>}
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                    <Phone className="h-3 w-3" /> Phone
                  </p>
                  {editingPhone ? (
                    <div className="flex items-center gap-2">
                      <Input type="tel" value={phoneValue} onChange={(e) => setPhoneValue(e.target.value)} className="h-8 border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white text-sm" />
                      <button onClick={handleSavePhone} disabled={savingPhone} className="text-[hsl(var(--accent))] hover:text-white"><Check className="h-4 w-4" /></button>
                      <button onClick={() => { setEditingPhone(false); setPhoneValue(profile.phone ?? ""); }} className="text-[hsl(var(--muted-foreground))] hover:text-white"><X className="h-4 w-4" /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-white">{profile.phone || "Not set"}</p>
                      <button onClick={() => setEditingPhone(true)} className="text-[hsl(var(--muted-foreground))] hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
                {profile.address && (
                  <div>
                    <p className="flex items-center gap-1.5 text-xs font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                      <MapPin className="h-3 w-3" /> Address
                    </p>
                    <p className="text-white">{profile.address}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Referral Program */}
          <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                <Gift className="h-5 w-5 text-[hsl(var(--accent))]" />
                Referral Program
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                  Your Referral Code
                </p>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-bold text-[hsl(var(--accent))] tracking-[4px]">
                    {profile.referral_code ?? "—"}
                  </span>
                  {profile.referral_code && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(profile.referral_code!);
                        toast.success("Referral code copied!");
                      }}
                      className="text-xs text-[hsl(var(--muted-foreground))] hover:text-white border border-[hsl(var(--muted))]/60 rounded px-2 py-1 transition-colors"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-[hsl(var(--muted-foreground))] mb-1">
                  Referral Credits
                </p>
                <p className="text-2xl font-bold text-white">
                  {profile.referral_credits ?? 0}
                  <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]"> / 3 for a free Premium Detail</span>
                </p>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">
                Share your code with friends. When they book using your code they get 10% off, and you earn 1 credit. Collect 3 credits for a free Premium Detail!
              </p>
              {(profile.referral_credits ?? 0) >= 3 && (
                <Link
                  href="/book?redeem=referral"
                  className="inline-flex items-center gap-2 bg-gradient-to-br from-[#1262d4] to-[#1a4aff] text-white font-[family-name:var(--font-barlow-condensed)] text-sm font-bold tracking-wider uppercase px-6 py-3 rounded-lg shadow-[0_0_30px_rgba(26,74,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_0_50px_rgba(26,74,255,0.6)] transition-all mt-2"
                >
                  <Gift className="h-4 w-4" />
                  Redeem Free Premium Detail
                </Link>
              )}
            </CardContent>
          </Card>
          </>
        )}

        {/* Upcoming Visits */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayStr = today.toISOString().split("T")[0];

          type Visit = {
            id: string;
            type: "booking" | "subscription";
            date: string;
            time: string;
            packageKey: PackageId;
            serviceTypeKey: ServiceType;
            vehicleSizeKey: VehicleSize;
            label?: string;
            refCode?: string;
            estimate?: number;
          };

          const visits: Visit[] = [];

          // Add upcoming confirmed bookings
          for (const b of bookings) {
            if (b.status === "confirmed" && b.booking_date >= todayStr) {
              visits.push({
                id: b.id,
                type: "booking",
                date: b.booking_date,
                time: b.booking_time,
                packageKey: b.package,
                serviceTypeKey: b.service_type,
                vehicleSizeKey: b.vehicle_size,
                refCode: b.reference_code,
                estimate: b.total_estimate,
              });
            }
          }

          // Add next subscription visits
          for (const sub of subscriptions) {
            if (sub.next_service_date && sub.next_service_date >= todayStr) {
              visits.push({
                id: sub.id,
                type: "subscription",
                date: sub.next_service_date,
                time: sub.recurring_time,
                packageKey: sub.package,
                serviceTypeKey: sub.service_type,
                vehicleSizeKey: sub.vehicle_size,
                label: SUBSCRIPTION_PLANS.find((p) => p.id === sub.plan)?.name,
              });
            }
          }

          // Sort by date then time
          visits.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
          });

          return (
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  <CalendarDays className="h-5 w-5 text-[hsl(var(--accent))]" />
                  Upcoming Visits
                </CardTitle>
              </CardHeader>
              <CardContent>
                {visits.length === 0 ? (
                  <p className="py-6 text-center text-[hsl(var(--muted-foreground))]">
                    No upcoming visits. Book a detail or subscribe to get started!
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visits.map((visit, idx) => {
                      const isNext = idx === 0;
                      return (
                        <div
                          key={`${visit.type}-${visit.id}`}
                          className={`rounded-lg border p-4 transition-all ${
                            isNext
                              ? "border-yellow/40 bg-yellow/5 ring-1 ring-yellow/20"
                              : "border-[hsl(var(--muted))] bg-[hsl(var(--background))]"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                {isNext && (
                                  <Badge variant="outline" className="bg-yellow/15 text-yellow border-yellow/30 text-xs">
                                    Next Visit
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={
                                    visit.type === "subscription"
                                      ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30 text-xs"
                                      : "bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs"
                                  }
                                >
                                  {visit.type === "subscription" ? (visit.label ?? "Subscription") : "One-Time Booking"}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                <span className={`flex items-center gap-1 ${isNext ? "text-yellow font-medium" : ""}`}>
                                  <CalendarDays className="h-3.5 w-3.5" />
                                  {new Date(visit.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                                </span>
                                <span className={`flex items-center gap-1 ${isNext ? "text-yellow font-medium" : ""}`}>
                                  <Clock className="h-3.5 w-3.5" />
                                  {visit.time}
                                </span>
                                <span>{packageLabels[visit.packageKey]}</span>
                                <span>{serviceTypeLabels[visit.serviceTypeKey]}</span>
                                <span className="flex items-center gap-1">
                                  <Car className="h-3.5 w-3.5" />
                                  {vehicleLabels[visit.vehicleSizeKey]}
                                </span>
                              </div>
                            </div>
                            {visit.estimate && (
                              <p className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[hsl(var(--accent))]">
                                ${visit.estimate}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Subscriptions Section */}
        <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
                My Subscriptions
              </CardTitle>
              <Link
                href="/subscriptions"
                className="inline-flex items-center gap-1.5 rounded-md bg-[hsl(var(--primary))] px-3 py-1.5 text-sm font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-white hover:bg-[hsl(var(--primary))]/80 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Subscription
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {subscriptions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[hsl(var(--muted-foreground))] mb-4">You don&apos;t have any active subscriptions yet.</p>
                <Link
                  href="/subscriptions"
                  className="inline-flex items-center justify-center rounded-md bg-[hsl(var(--primary))] font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-white hover:bg-[hsl(var(--primary))]/80 px-4 py-2 text-sm font-medium"
                >
                  Browse Subscription Plans
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Plan</p>
                        <p className="mt-1 font-[family-name:var(--font-barlow-condensed)] text-lg text-white">
                          {SUBSCRIPTION_PLANS.find((p) => p.id === sub.plan)?.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Package</p>
                        <p className="mt-1 font-[family-name:var(--font-barlow-condensed)] text-lg text-white">{packageLabels[sub.package]}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Schedule</p>
                        <p className="mt-1 font-[family-name:var(--font-barlow-condensed)] text-lg text-white">
                          {sub.recurring_day} at {sub.recurring_time}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Next Service</p>
                        <p className="mt-1 font-[family-name:var(--font-barlow-condensed)] text-lg text-[hsl(var(--accent))]">
                          {sub.next_service_date
                            ? new Date(sub.next_service_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "TBD"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Price</p>
                        <p className="mt-1 font-[family-name:var(--font-barlow-condensed)] text-lg text-[hsl(var(--accent))]">
                          ${dbGetSubPrice(sub.plan, sub.vehicle_size, sub.package)}<span className="text-xs text-[hsl(var(--muted-foreground))]">/visit</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                      <span>{serviceTypeLabels[sub.service_type]}</span>
                      <span>&mdash;</span>
                      <span>{vehicleLabels[sub.vehicle_size]}</span>
                      {sub.location === "mobile" && <span>&mdash; Mobile</span>}
                    </div>
                    <div className="flex gap-3 pt-3">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="inline-flex items-center rounded-md border border-[hsl(var(--muted-foreground))]/30 px-3 py-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-white hover:border-white/50 transition-colors"
                      >
                        <Settings className="mr-1.5 h-3.5 w-3.5" />
                        Manage
                      </button>
                      <button
                        onClick={() => setConfirmCancelSub(sub)}
                        className="inline-flex items-center rounded-md border border-red-500/30 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Subscription Modal */}
        <Dialog open={!!editingSub} onOpenChange={(open) => !open && setEditingSub(null)}>
          <DialogContent className="border-[hsl(var(--accent))]/30 bg-[#0b1740] shadow-xl shadow-[hsl(var(--accent))]/10 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                Update Subscription
              </DialogTitle>
              {editingSub && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {packageLabels[editingSub.package]} &mdash; {serviceTypeLabels[editingSub.service_type]} &mdash; {vehicleLabels[editingSub.vehicle_size]}
                </p>
              )}
            </DialogHeader>
            <div className="space-y-5 pt-2">
              {editError && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {editError}
                </div>
              )}

              {/* Frequency */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[hsl(var(--accent))]">Frequency</Label>
                <div className="flex flex-wrap gap-2">
                  {SUBSCRIPTION_PLANS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditPlan(p.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                        editPlan === p.id
                          ? "bg-[hsl(var(--accent))] text-[#0b1740] shadow-[0_0_12px_rgba(91,243,255,0.3)]"
                          : "bg-[#0d1f52] border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-white hover:border-[hsl(var(--accent))]/40"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[hsl(var(--accent))]">Preferred Day</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setEditDay(d); setEditTime(""); setEditError(""); }}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                        editDay === d
                          ? "bg-[hsl(var(--accent))] text-[#0b1740] shadow-[0_0_12px_rgba(91,243,255,0.3)]"
                          : "bg-[#0d1f52] border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-white hover:border-[hsl(var(--accent))]/40"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-[hsl(var(--accent))]">Preferred Time</Label>
                <div className="flex flex-wrap gap-2">
                  {TIME_SLOTS.map((t) => {
                    const blocked = isTimeBlocked(t, editBookedTimes);
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={blocked}
                        onClick={() => { if (!blocked) { setEditTime(t); setEditError(""); } }}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold tracking-wide transition-all ${
                          blocked
                            ? "bg-[#0d1f52]/50 border border-white/5 text-white/20 cursor-not-allowed line-through"
                            : editTime === t
                            ? "bg-[hsl(var(--accent))] text-[#0b1740] shadow-[0_0_12px_rgba(91,243,255,0.3)]"
                            : "bg-[#0d1f52] border border-white/10 text-[hsl(var(--muted-foreground))] hover:text-white hover:border-[hsl(var(--accent))]/40"
                        }`}
                      >
                        {t}
                        {blocked && <span className="block text-[10px] text-red-400/50 no-underline font-normal">Booked</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                onClick={handleUpdateSubscription}
                disabled={saving || !editTime}
                className="w-full bg-[hsl(var(--accent))] text-[#0b1740] font-[family-name:var(--font-barlow-condensed)] text-base font-bold uppercase tracking-wider hover:bg-[hsl(var(--accent))]/80 shadow-[0_0_20px_rgba(91,243,255,0.2)]"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel Subscription Confirmation Modal */}
        <Dialog open={!!confirmCancelSub} onOpenChange={(open) => !open && setConfirmCancelSub(null)}>
          <DialogContent className="border-red-500/20 bg-[hsl(var(--card))] shadow-xl">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                Cancel Subscription
              </DialogTitle>
            </DialogHeader>
            {confirmCancelSub && (
              <div className="space-y-4 pt-2">
                <p className="text-[hsl(var(--muted-foreground))]">
                  Are you sure you want to cancel your{" "}
                  <span className="text-white font-medium">{packageLabels[confirmCancelSub.package]}</span>{" "}
                  subscription ({confirmCancelSub.recurring_day} at {confirmCancelSub.recurring_time})?
                </p>
                <p className="text-sm text-red-400">This action cannot be undone.</p>
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleCancelSubscription}
                    disabled={cancellingId === confirmCancelSub.id}
                    className="flex-1 bg-red-600 font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-white hover:bg-red-700"
                  >
                    {cancellingId === confirmCancelSub.id ? "Cancelling..." : "Yes, Cancel Subscription"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmCancelSub(null)}
                    className="flex-1 border-[hsl(var(--muted-foreground))]/30 text-[hsl(var(--muted-foreground))] hover:text-white"
                  >
                    Keep Subscription
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Booking History */}
        <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
              <CalendarDays className="h-5 w-5 text-[hsl(var(--accent))]" />
              Booking History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="py-8 text-center text-[hsl(var(--muted-foreground))]">No bookings yet. Book your first detail today!</p>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking.id} className="rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-[family-name:var(--font-barlow-condensed)] text-lg font-semibold text-white">{packageLabels[booking.package]}</h3>
                          <Badge variant="outline" className={statusColors[booking.status]}>{statusLabels[booking.status]}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                          <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(booking.booking_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{booking.booking_time}</span>
                          <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{vehicleLabels[booking.vehicle_size]}</span>
                        </div>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{serviceTypeLabels[booking.service_type]}</p>
                        {booking.addons?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {booking.addons.map((addon) => (
                              <Badge key={addon.id} variant="outline" className="bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/20 text-xs">
                                {addon.name} +${addon.price}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="font-[family-name:var(--font-barlow-condensed)] text-xl font-bold text-[hsl(var(--accent))]">${booking.total_estimate}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">Ref: {booking.reference_code}</p>
                        {booking.status === "confirmed" && (
                          <button
                            onClick={() => openAddonEditor(booking)}
                            className="text-xs text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
                          >
                            <Pencil className="inline h-3 w-3 mr-1" />Edit Add-Ons
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {/* Edit Addons Modal */}
        <Dialog open={!!editingBookingAddons} onOpenChange={(open) => !open && setEditingBookingAddons(null)}>
          <DialogContent className="border-[hsl(var(--accent))]/20 bg-[#0b1740] shadow-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                Edit Add-Ons
              </DialogTitle>
              {editingBookingAddons && (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  {packageLabels[editingBookingAddons.package]} — {new Date(editingBookingAddons.booking_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {editingBookingAddons.booking_time}
                </p>
              )}
            </DialogHeader>
            {editingBookingAddons && (
              <div className="pt-2">
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {dbAddons.map((addon) => {
                    const isIncluded = editingBookingAddons.package === "exclusive" && EXCLUSIVE_INCLUDED.includes(addon.id);
                    const isSelected = editAddons.some((a) => a.id === addon.id);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        disabled={isIncluded}
                        onClick={() => toggleAddon(addon)}
                        className={`w-full flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-all ${
                          isIncluded
                            ? "border-[hsl(var(--accent))]/20 bg-[hsl(var(--accent))]/5 text-[hsl(var(--accent))]"
                            : isSelected
                            ? "border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/10 text-white"
                            : "border-white/10 bg-[#0d1f52] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--accent))]/30 hover:text-white"
                        }`}
                      >
                        <span className="font-medium">
                          {addon.name}
                          {isIncluded && <span className="ml-2 text-xs text-[hsl(var(--accent))]/60">(Included)</span>}
                        </span>
                        <span className={isSelected || isIncluded ? "text-[hsl(var(--accent))]" : ""}>${addon.price}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
                  <span className="text-[hsl(var(--muted-foreground))] text-sm">New Total</span>
                  <span className="font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold text-[hsl(var(--accent))]">
                    ${dbGetPrice(editingBookingAddons.package, editingBookingAddons.vehicle_size, editingBookingAddons.service_type) +
                      editAddons
                        .filter((a) => !(editingBookingAddons.package === "exclusive" && EXCLUSIVE_INCLUDED.includes(a.id)))
                        .reduce((sum, a) => sum + a.price, 0)}
                  </span>
                </div>
                <button
                  onClick={handleSaveAddons}
                  disabled={savingAddons}
                  className="w-full mt-4 py-3 rounded-lg bg-cyan text-navy font-[family-name:var(--font-barlow-condensed)] text-base font-bold uppercase tracking-wider hover:opacity-90 shadow-[0_0_20px_rgba(91,243,255,0.3)] disabled:opacity-50"
                >
                  {savingAddons ? "Saving..." : "Update Add-Ons"}
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
