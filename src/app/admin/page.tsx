"use client";

import { use, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  updateBookingStatus,
  blockTimeSlot,
  unblockSlot,
  getBlockedSlots,
  listPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
  type PromoCodeRow,
} from "./actions";
import { PROMO_LIMIT_LABELS, PROMO_LIMITS, type PromoUsageLimit } from "@/lib/promo-policy";
import { buildAdminCustomers } from "@/lib/admin-customers";
import BookingAdminTools from "./booking-admin-tools";
import AppointmentHistory from "./appointment-history";
import type { Booking } from "@/lib/admin-history";
import { syncCalendarRange } from "./booking-tools-actions";
import { parseBookingTime, getBookingDurationMinutes, formatBookingTime, getCalgaryNow } from "@/lib/booking-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, EventClickArg } from "@fullcalendar/core";
import { addMinutes, addWeeks, differenceInCalendarWeeks, addDays, startOfDay, format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  History,
  Users,
  Clock,
  Shield,
  ShieldCheck,
  UserCog,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  Ban,
  Trash2,
  XCircle,
  Tag,
  Gift,
  DollarSign,
  Search,
} from "lucide-react";
import PricingManager from "./pricing/pricing-manager";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { fetchSubscriptionPrices, type SubPricingGrid } from "@/lib/pricing-db";
import {
  PACKAGE_LABELS,
  VEHICLE_LABELS,
  SERVICE_TYPE_LABELS,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PRICING,
  type BookingStatus,
  type PackageId,
  type VehicleSize,
  type ServiceType,
  type SubscriptionStatus,
} from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

function normalizeBlockTime(value: string): string | null {
  const text = value.trim();
  let minutes = parseBookingTime(text);
  if (minutes === null && /^([01]?\d|2[0-3]):[0-5]\d$/.test(text)) {
    const [hours, mins] = text.split(":").map(Number);
    minutes = hours * 60 + mins;
  }
  return minutes === null ? null : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  email?: string;
  referral_code?: string;
  referral_credits?: number;
}

interface Subscription {
  id: string;
  user_id: string;
  status: SubscriptionStatus;
  plan: string;
  package: PackageId;
  service_type: ServiceType;
  vehicle_size: VehicleSize;
  recurring_day: string;
  recurring_time: string;
  location: string;
  service_address: string | null;
  next_service_date: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { first_name: string; last_name: string; phone: string } | null;
}

// A unified calendar entry (booking or subscription occurrence)
interface CalendarEntry {
  type: "booking" | "subscription";
  time: string;
  name: string;
  booking?: Booking;
  subscription?: Subscription;
  occurrenceDate?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

function SubscriptionCard({ subscription, price, customerName }: {
  subscription: Subscription;
  price: number;
  customerName?: string;
}) {
  const plan = SUBSCRIPTION_PLANS.find(item => item.id === subscription.plan)?.name ?? subscription.plan;
  const nextVisit = subscription.next_service_date
    ? format(new Date(subscription.next_service_date + "T12:00:00"), "MMM d, yyyy")
    : "To be scheduled";
  return (
    <li className="space-y-4 rounded-xl border border-white/10 bg-dark/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-white">{customerName ?? PACKAGE_LABELS[subscription.package]}</p>
          <p className="mt-1 text-sm text-mid">{plan}{customerName && ` · ${PACKAGE_LABELS[subscription.package]}`}</p>
        </div>
        <Badge variant="outline" className={subscription.status === "active" ? "border-green-400/30 text-green-400" : "border-white/20 text-mid"}>
          <span className="capitalize">{subscription.status}</span>
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-4 border-t border-white/10 pt-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-mid">Price per visit</dt>
          <dd className="mt-1 font-semibold text-cyan">${price}</dd>
        </div>
        <div>
          <dt className="text-xs text-mid">Next visit</dt>
          <dd className="mt-1 text-white">{nextVisit}</dd>
        </div>
        <div>
          <dt className="text-xs text-mid">Schedule</dt>
          <dd className="mt-1 text-white">{subscription.recurring_day} at {subscription.recurring_time}</dd>
        </div>
        <div>
          <dt className="text-xs text-mid">Service &amp; vehicle</dt>
          <dd className="mt-1 text-white">{SERVICE_TYPE_LABELS[subscription.service_type]} · {VEHICLE_LABELS[subscription.vehicle_size]}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-mid">
        <span>{subscription.location === "mobile" ? "Mobile" : "In-shop"}</span>
        {subscription.service_address && <span className="break-words">{subscription.service_address}</span>}
        {customerName && subscription.profiles?.phone && <span>{subscription.profiles.phone}</span>}
      </div>
    </li>
  );
}

const adminTabClass = "h-auto flex-none rounded-lg border-white/15 bg-dark px-4 py-2.5 text-mid hover:text-white focus-visible:ring-cyan/50 data-active:border-cyan! data-active:bg-cyan! data-active:text-navy!";

export default function AdminPage({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const initialTab = use(searchParams).tab === "pricing" ? "pricing" : "calendar";
  const supabase = useMemo(() => createClient(), []);

  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [calendarView, setCalendarView] = useState("dayGridMonth");
  const [calendarRange, setCalendarRange] = useState<{ start: string; end: string } | null>(null);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [calendarSyncMessage, setCalendarSyncMessage] = useState("");
  const handleCalendarRange = useCallback((range: { startStr: string; endStr: string; view: { type: string } }) => {
    setCalendarView(range.view.type);
    const start = range.startStr.slice(0, 10);
    const end = range.endStr.slice(0, 10);
    setCalendarRange((previous) => previous?.start === start && previous.end === end ? previous : { start, end });
  }, []);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);

  // Data state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // Current user role
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin");
  const isOwner = currentUserRole === "owner";

  // Team management state
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [teamFormError, setTeamFormError] = useState("");

  // Blocked slots
  const [blockedSlots, setBlockedSlots] = useState<{ id: string; blocked_date: string; blocked_time: string | null; start_time: string | null; end_time: string | null; reason: string | null }[]>([]);
  const [blockDate, setBlockDate] = useState("");
  const [blockStart, setBlockStart] = useState("9:00 AM");
  const [blockEnd, setBlockEnd] = useState("5:00 PM");
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockError, setBlockError] = useState<{ field: "range" | "form"; message: string } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockWholeDay, setBlockWholeDay] = useState(false);

  // Upcoming visits filter
  const [visitFilter, setVisitFilter] = useState<"3days" | "week">("3days");

  // Cancel booking modal
  const [cancelBooking, setCancelBooking] = useState<{ id: string; name: string; date: string; time: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Customer search + detail modal
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [includeArchivedCustomers, setIncludeArchivedCustomers] = useState(false);
  const customerRows = useMemo(() => buildAdminCustomers(profiles, bookings, includeArchivedCustomers), [profiles, bookings, includeArchivedCustomers]);
  const selectedCustomer = customerRows.find(customer => customer.id === selectedCustomerId) ?? null;
  const latestCustomerBooking = bookings.find(booking => booking.id === selectedCustomer?.booking_ids[0]);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // DB subscription pricing
  const [dbSubPricing, setDbSubPricing] = useState<SubPricingGrid>(
    SUBSCRIPTION_PRICING as unknown as SubPricingGrid
  );

  function dbGetSubPrice(plan: string, vs: string, pkg: string) {
    return dbSubPricing?.[plan]?.[pkg]?.[vs] ?? 0;
  }

  // Promo codes
  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>([]);
  const [promoForm, setPromoForm] = useState({
    code: "",
    discount_pct: 10,
    scope: "booking" as "booking" | "subscription",
    usage_limit: "unlimited" as PromoUsageLimit,
    active: true,
  });
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoLimitSaving, setPromoLimitSaving] = useState<string | null>(null);
  const [promoFormError, setPromoFormError] = useState("");

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: "default" | "destructive";
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  function showConfirm(opts: Omit<typeof confirmModal, "open">) {
    setConfirmModal({ ...opts, open: true });
  }

  /* ---- Data fetching ---- */

  const fetchBookings = useCallback(async () => {
    const allData: Booking[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("bookings").select("*")
        .order("booking_date", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 499);
      if (error) { toast.error("Could not load bookings. Please refresh the dashboard."); return; }
      const batch = (data ?? []) as Booking[];
      if (!batch.length) break;
      const { data: archives, error: archiveError } = await supabase.from("booking_admin_archives").select("booking_id,archived_at").in("booking_id", batch.map(b => b.id));
      if (archiveError) { toast.error("Could not load archived booking details. Please refresh the dashboard."); return; }
      const archiveMap = new Map<string, string>((archives ?? []).map(a => [a.booking_id, a.archived_at]));
      allData.push(...batch.map(b => ({ ...b, archived_at: archiveMap.get(b.id) ?? null })));
      if (batch.length < 500) break;
    }
    const todayStr = getCalgaryNow().date;
    setBookings(allData);
    setHistoryRevision(v => v + 1);
    setAllBookings(allData.filter(b => b.booking_date >= todayStr && b.status === "confirmed" && !b.archived_at));
  }, [supabase]);

  const fetchCurrentUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile) setCurrentUserRole(profile.role);
    }
  }, [supabase]);

  const fetchProfiles = useCallback(async () => {
    const [profileRes, subRes, teamRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("role", "customer")
        .order("last_name", { ascending: true }),
      supabase
        .from("subscriptions")
        .select("*")
        .order("updated_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("*")
        .in("role", ["admin", "owner"])
        .order("role", { ascending: false }),
    ]);

    // Manually attach profile data to subscriptions
    const allProfiles = [...(profileRes.data ?? []), ...(teamRes.data ?? [])];
    const subsWithProfiles = (subRes.data ?? []).map((sub: Subscription) => {
      const p = allProfiles.find((pr: Profile) => pr.id === sub.user_id);
      return {
        ...sub,
        profiles: p ? { first_name: p.first_name, last_name: p.last_name, phone: p.phone } : null,
      };
    });

    // Fetch customer emails from auth.users via RPC
    const { data: emailData } = await supabase.rpc("get_customer_emails");
    const emailMap = new Map<string, string>();
    if (emailData) {
      for (const row of emailData) emailMap.set(row.id, row.email);
    }

    const profilesWithEmail = ((profileRes.data ?? []) as Profile[]).map((p) => ({
      ...p,
      email: emailMap.get(p.id),
    }));

    setProfiles(profilesWithEmail);
    setSubscriptions(subsWithProfiles as Subscription[]);
    setTeamMembers((teamRes.data as Profile[]) ?? []);
  }, [supabase]);

  const fetchBlocked = useCallback(async () => {
    const data = await getBlockedSlots();
    setBlockedSlots(data);
  }, []);

  const fetchPromoCodes = useCallback(async () => {
    try {
      const data = await listPromoCodes();
      setPromoCodes(data);
    } catch (e) {
      console.error("Promo fetch error:", e);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCurrentUser(),
      fetchBookings(),
      fetchProfiles(),
      fetchBlocked(),
      fetchPromoCodes(),
      fetchSubscriptionPrices().then(setDbSubPricing),
    ]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePromoChange(id: string, patch: Parameters<typeof updatePromoCode>[1]) {
    try {
      const result = await updatePromoCode(id, patch);
      if (result.error) {
        toast.error(result.error);
        return false;
      }
      await fetchPromoCodes();
      return true;
    } catch {
      toast.error("Could not update this promo code. Please try again.");
      return false;
    }
  }

  // Refetch data when switching tabs
  useEffect(() => {
    fetchBookings();
    fetchProfiles();
    fetchBlocked();
    fetchPromoCodes();
    fetchSubscriptionPrices().then(setDbSubPricing);
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Helpers ---- */

  function getBookingName(b: Booking): string {
    if (b.user_id) {
      const p = profiles.find((pr) => pr.id === b.user_id);
      if (p) return `${p.first_name} ${p.last_name}`;
    }
    if (b.guest_first_name) return `${b.guest_first_name} ${b.guest_last_name ?? ""}`.trim();
    return "Guest";
  }

  function formatRangeTime(time: string): string {
    const [hour, minute] = time.split(":").map(Number);
    return formatBookingTime(hour * 60 + minute);
  }

  function parseTimeTo24(time: string): string {
    const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return "00:00";
    let hour = parseInt(match[1]);
    if (match[3].toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (match[3].toUpperCase() === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
  }

  async function handleStatusChange(bookingId: string, status: BookingStatus) {
    await updateBookingStatus(bookingId, status);
    await fetchBookings();
    setSelectedEntry(null);
    setHistoryRevision(value => value + 1);
  }

  function getSubscriptionsForUser(userId: string): Subscription[] {
    return subscriptions.filter((s) => s.user_id === userId && ["active", "paused"].includes(s.status));
  }

  /* ---- FullCalendar events ---- */

  const calendarEvents = useMemo((): EventInput[] => {
    const events: EventInput[] = [];

    // Bookings
    for (const b of bookings) {
      if (b.status === "cancelled" || b.archived_at) continue;
      const time24 = parseTimeTo24(b.booking_time);
      const name = getBookingName(b);
      events.push({
        id: `booking-${b.id}`,
        title: `${b.booking_time} ${name}`,
        start: `${b.booking_date}T${time24}:00`,
        end: format(addMinutes(new Date(`${b.booking_date}T${time24}:00`), getBookingDurationMinutes(b.package, b.vehicle_size, b.addons ?? [])), "yyyy-MM-dd'T'HH:mm:ss"),
        backgroundColor: b.status === "confirmed" ? "#1a4aff" : b.status === "completed" ? "#22c55e" : "#f5c518",
        borderColor: "transparent",
        extendedProps: { type: "booking", booking: b, name },
      });
    }

    // Subscriptions — generate occurrences for 3 months out
    const today = startOfDay(new Date());
    const threeMonthsOut = addDays(today, 90);

    for (const s of subscriptions) {
      if (s.status !== "active" || !s.next_service_date) continue;

      const name = s.profiles ? `${s.profiles.first_name} ${s.profiles.last_name}` : "Unknown";
      const time24 = parseTimeTo24(s.recurring_time);
      const interval = s.plan === "weekly" ? 1 : s.plan === "biweekly" ? 2 : 4;
      const startDate = startOfDay(new Date(s.next_service_date + "T12:00:00"));

      // Generate occurrences from start date
      let current = startDate;
      // Also go backwards a bit for past months visible in calendar
      const calStart = addDays(today, -60);
      if (current > calStart) {
        // Find first occurrence on or after calStart
        const weeksBack = differenceInCalendarWeeks(current, calStart);
        const stepsBack = Math.ceil(weeksBack / interval);
        current = addWeeks(startDate, -stepsBack * interval);
        if (current < calStart) current = addWeeks(current, interval);
      }

      while (current <= threeMonthsOut) {
        const dateStr = current.toLocaleDateString("en-CA");
        events.push({
          id: `sub-${s.id}-${dateStr}`,
          title: `${s.recurring_time} ${name}`,
          start: `${dateStr}T${time24}:00`,
          backgroundColor: "#5bf3ff",
          textColor: "#0b1740",
          borderColor: "transparent",
          extendedProps: { type: "subscription", subscription: s, name },
        });
        current = addWeeks(current, interval);
      }
    }

    // Blocked slots
    for (const bl of blockedSlots) {
      if (!bl.blocked_time && !bl.start_time) {
        events.push({
          id: `blocked-${bl.id}`,
          title: bl.reason || "Blocked",
          start: bl.blocked_date,
          allDay: true,
          backgroundColor: "#ef4444",
          borderColor: "transparent",
          display: "background",
        });
      } else {
        const time24 = bl.start_time ? bl.start_time.slice(0, 5) : parseTimeTo24(bl.blocked_time!);
        events.push({
          id: `blocked-${bl.id}`,
          title: `${bl.start_time ? formatRangeTime(bl.start_time) + "–" + formatRangeTime(bl.end_time!) : bl.blocked_time} — ${bl.reason || "Blocked"}`,
          start: `${bl.blocked_date}T${time24}:00`,
          end: bl.end_time ? `${bl.blocked_date}T${bl.end_time}` : undefined,
          backgroundColor: "#ef4444",
          borderColor: "transparent",
          extendedProps: { type: "blocked" },
        });
      }
    }

    return events;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, subscriptions, blockedSlots, profiles]);

  function handleEventClick(info: EventClickArg) {
    const props = info.event.extendedProps;
    if (props.type === "booking") {
      setSelectedEntry({
        type: "booking",
        time: props.booking.booking_time,
        name: props.name,
        booking: props.booking,
      });
    } else if (props.type === "subscription") {
      setSelectedEntry({
        type: "subscription",
        time: props.subscription.recurring_time,
        name: props.name,
        subscription: props.subscription,
        occurrenceDate: info.event.startStr.slice(0, 10),
      });
    }
  }

  const activeSubscriptions = subscriptions.filter(subscription => subscription.status === "active");
  const customerSubscriptions = selectedCustomer ? getSubscriptionsForUser(selectedCustomer.id) : [];

  const detailBooking = selectedEntry?.booking;
  const detailSubscription = selectedEntry?.subscription;
  const appointment = detailBooking ?? detailSubscription;
  const appointmentPhone = appointment?.profiles?.phone || detailBooking?.guest_phone;
  const appointmentAddress = appointment?.service_address || detailBooking?.guest_address;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
        <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] px-4 pt-[100px] pb-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-xs uppercase tracking-[3px] text-cyan">Calgary</p>
          <h1 className="mt-2 font-[family-name:var(--font-heading)] text-4xl uppercase tracking-wide text-white">
            Admin Dashboard
          </h1>
        </header>

        {/* Upcoming Visits */}
        {(() => {
          const todayStr = getCalgaryNow().date;
          const cutoff = addDays(new Date(todayStr + "T12:00:00"), visitFilter === "3days" ? 3 : 7);
          const cutoffStr = format(cutoff, "yyyy-MM-dd");

          type Visit = {
            id: string;
            type: "booking" | "subscription";
            date: string;
            time: string;
            name: string;
            packageKey: PackageId;
            serviceTypeKey: ServiceType;
            price: number;
            phone?: string;
          };

          const visits: Visit[] = [];

          for (const b of allBookings) {
            if (b.booking_date >= todayStr && b.booking_date <= cutoffStr) {
              const name = getBookingName(b);
              const phone = b.guest_phone || undefined;
              visits.push({
                id: b.id, type: "booking", date: b.booking_date, time: b.booking_time,
                name,
                packageKey: b.package, serviceTypeKey: b.service_type,
                price: b.total_estimate, phone,
              });
            }
          }

          for (const s of subscriptions) {
            if (s.status === "active" && s.next_service_date && s.next_service_date >= todayStr && s.next_service_date <= cutoffStr) {
              const name = s.profiles ? `${s.profiles.first_name} ${s.profiles.last_name}` : "Unknown";
              visits.push({
                id: s.id, type: "subscription", date: s.next_service_date, time: s.recurring_time,
                name, packageKey: s.package, serviceTypeKey: s.service_type,
                price: dbGetSubPrice(s.plan, s.vehicle_size, s.package), phone: s.profiles?.phone || undefined,
              });
            }
          }

          visits.sort((a, b) => a.date.localeCompare(b.date) ||
            (parseBookingTime(a.time) ?? Infinity) - (parseBookingTime(b.time) ?? Infinity));

          return (
            <Card className="rounded-2xl border-white/15 bg-navy/25">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                    <Clock className="size-5 text-cyan" />
                    Upcoming Visits
                  </CardTitle>
                  <div role="group" aria-label="Upcoming visit range" className="flex gap-2">
                    {(["3days", "week"] as const).map(range => (
                      <button key={range} type="button" aria-pressed={visitFilter === range}
                        onClick={() => setVisitFilter(range)}
                        className="rounded-lg border border-white/15 bg-dark px-3 py-2 text-sm text-mid hover:text-white focus-visible:outline-2 focus-visible:outline-cyan aria-pressed:border-cyan aria-pressed:bg-cyan aria-pressed:text-navy">
                        {range === "3days" ? "3 Days" : "Week"}
                      </button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {visits.length === 0 ? (
                  <p className="py-4 text-[hsl(var(--muted-foreground))]">No visits in the next {visitFilter === "3days" ? "3 days" : "week"}.</p>
                ) : (
                  <div className="space-y-2">
                    {visits.map((visit, idx) => {
                      const isNext = idx === 0;
                      return (
                        <div
                          key={`${visit.type}-${visit.id}`}
                          className={`rounded-lg border p-3 flex flex-wrap items-center justify-between gap-2 ${
                            isNext ? "border-cyan/30 bg-cyan/5" : "border-white/10 bg-dark/60"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {isNext && (
                              <Badge variant="outline" className="bg-cyan/10 text-cyan border-cyan/30 text-xs">Next</Badge>
                            )}
                            <Badge variant="outline" className={
                              visit.type === "subscription"
                                ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30 text-xs"
                                : "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30 text-xs"
                            }>
                              {visit.type === "subscription" ? "Sub" : "Booking"}
                            </Badge>
                            <span className={`text-sm font-medium ${isNext ? "text-cyan" : "text-white"}`}>
                              {new Date(visit.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </span>
                            <span className={`text-sm ${isNext ? "text-cyan" : "text-[hsl(var(--muted-foreground))]"}`}>{visit.time}</span>
                            <span className="text-sm text-white font-medium">{visit.name}</span>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">{PACKAGE_LABELS[visit.packageKey]} · {SERVICE_TYPE_LABELS[visit.serviceTypeKey]}</span>
                            {visit.phone && <span className="text-xs text-[hsl(var(--muted-foreground))]">{visit.phone}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[hsl(var(--accent))]">${visit.price}</span>
                            {visit.type === "booking" && (
                              <button
                                onClick={() => setCancelBooking({
                                  id: visit.id, name: visit.name, date: visit.date, time: visit.time,
                                })}
                                className="grid size-9 place-items-center rounded-lg border border-red-400/25 text-red-300 hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-cyan"
                                type="button"
                                aria-label={`Cancel booking for ${visit.name}`}
                                title="Cancel booking"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Admin sections" className="h-auto! flex-wrap justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="calendar" className={adminTabClass}>
              <Calendar className="size-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="history" className={adminTabClass}>
              <History className="size-4" />
              Appointment History
            </TabsTrigger>
            <TabsTrigger value="customers" className={adminTabClass}>
              <Users className="size-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className={adminTabClass}>
              <Sparkles className="size-4" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="promos" className={adminTabClass}>
              <Tag className="size-4" />
              Promos
            </TabsTrigger>
            <TabsTrigger value="pricing" className={adminTabClass}>
              <DollarSign className="size-4" />
              Pricing
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger value="team" className={adminTabClass}>
                <UserCog className="size-4" />
                Team
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="pricing" keepMounted>
            <PricingManager />
          </TabsContent>

          {/* ============ CALENDAR TAB ============ */}
          <TabsContent value="calendar" className="space-y-6">
            <Card className="rounded-2xl border-white/15 bg-navy/25">
              <CardContent className="pt-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-[family-name:var(--font-heading)] text-3xl text-white">Calendar</h2>
                    <p className="mt-1 text-sm text-mid">Sync bookings in this view to WOW Clean Bookings.</p>
                    <p className="text-xs text-mid mt-1" role="status" aria-live="polite">{calendarSyncMessage}</p>
                  </div>
                  <Button variant="outline" className="rounded-lg border-cyan/30 bg-dark text-cyan hover:bg-cyan/10 hover:text-cyan" disabled={calendarSyncing || !calendarRange} onClick={async () => {
                    if (!calendarRange || calendarSyncing) return;
                    const range = { ...calendarRange };
                    setCalendarSyncing(true);
                    setCalendarSyncMessage("Syncing bookings…");
                    let synced = 0;
                    let failed = 0;
                    let cursor: string | undefined;
                    try {
                      do {
                        const result = await syncCalendarRange(range.start, range.end, cursor);
                        synced += result.synced;
                        failed += result.failed;
                        cursor = result.nextCursor ?? undefined;
                        setCalendarSyncMessage(`${synced} synced${failed ? `, ${failed} failed` : ""}…`);
                      } while (cursor);
                      const message = synced + failed === 0
                        ? "No bookings in this calendar view."
                        : `${synced} booking${synced === 1 ? "" : "s"} synced to Google Calendar.${failed ? ` ${failed} failed—click Sync again to retry.` : ""}`;
                      setCalendarSyncMessage(message);
                      if (failed) toast.warning(message); else toast.success(message);
                    } catch {
                      const message = `Sync interrupted after ${synced} updates. Click Sync again to retry.`;
                      setCalendarSyncMessage(message);
                      toast.error(message);
                    } finally { setCalendarSyncing(false); }
                  }}>
                    {calendarSyncing ? "Syncing…" : "Sync to Google Calendar"}
                  </Button>
                </div>
                {/* Legend */}
                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-mid">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#5bf3ff" }} />
                    Subscription
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#1a4aff" }} />
                    Booking
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#ef4444" }} />
                    Blocked
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#22c55e" }} />
                    Completed
                  </span>
                </div>
                <div className="fc-dark-theme calgary-admin-calendar">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    datesSet={handleCalendarRange}
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    events={calendarEvents}
                    eventClick={handleEventClick}
                    height={calendarView === "dayGridMonth" ? "auto" : 680}
                    slotMinTime="08:00:00"
                    slotMaxTime="24:00:00"
                    scrollTime="08:00:00"
                    slotDuration="00:30:00"
                    slotLabelInterval="01:00:00"
                    expandRows={false}
                    stickyHeaderDates={true}
                    allDayText="All day"
                    eventDisplay="block"
                    displayEventTime={false}
                    dayMaxEvents={3}
                    nowIndicator={true}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Block Time */}
            <Card className="rounded-2xl border-white/15 bg-navy/25">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl uppercase tracking-wide text-white">
                  <Ban className="h-5 w-5 text-red-400" />
                  Block Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  aria-label="Block time"
                  aria-describedby="block-time-help"
                  onChange={() => setBlockError(null)}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (blockSaving || !blockDate) return;
                    const startTime = normalizeBlockTime(blockStart);
                    const endTime = normalizeBlockTime(blockEnd);
                    if (!blockWholeDay && (!startTime || !endTime || endTime <= startTime)) {
                      setBlockError({ field: "range", message: "Enter times like 9:00 AM and 5:00 PM. End time must be after start time." });
                      return;
                    }
                    setBlockError(null);
                    setBlockSaving(true);
                    try {
                      const result = await blockTimeSlot({
                        date: blockDate,
                        startTime: blockWholeDay ? undefined : startTime!,
                        endTime: blockWholeDay ? undefined : endTime!,
                        reason: blockReason || undefined,
                      });
                      if (result.error) {
                        setBlockError({ field: "form", message: result.error });
                        return;
                      }
                      toast.success("Time blocked.");
                      setBlockDate("");
                      setBlockReason("");
                      setBlockWholeDay(false);
                      await fetchBlocked();
                    } catch {
                      setBlockError({ field: "form", message: "Could not block this time. Please try again." });
                    } finally {
                      setBlockSaving(false);
                    }
                  }}
                >
                  <p id="block-time-help" className="mb-4 text-sm text-mid">
                    All times are in Calgary time. Move or cancel overlapping appointments before blocking.
                  </p>
                  <fieldset disabled={blockSaving} className="space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="block-date" className="text-mid">Date</Label>
                        <Input
                          id="block-date"
                          type="date"
                          required
                          min={getCalgaryNow().date}
                          value={blockDate}
                          onChange={(event) => setBlockDate(event.target.value)}
                          className="w-44 rounded-lg border-white/20 bg-navy text-white [color-scheme:dark]"
                        />
                      </div>
                      <label className="flex min-h-9 items-center gap-2 text-sm text-white">
                        <input type="checkbox" className="size-4 accent-cyan" checked={blockWholeDay} onChange={(event) => setBlockWholeDay(event.target.checked)} />
                        All day
                      </label>
                    </div>
                    {!blockWholeDay && (
                      <div>
                        <div className="grid max-w-sm grid-cols-2 gap-3">
                          <label className="space-y-1 text-sm text-mid">
                            Start time
                            <Input required autoComplete="off" spellCheck={false} placeholder="9:00 AM" value={blockStart}
                              onChange={(event) => setBlockStart(event.target.value)}
                              aria-invalid={blockError?.field === "range"}
                              aria-describedby={blockError?.field === "range" ? "block-range-error" : undefined}
                              className="rounded-lg border-white/20 bg-navy text-white" />
                          </label>
                          <label className="space-y-1 text-sm text-mid">
                            End time
                            <Input required autoComplete="off" spellCheck={false} placeholder="5:00 PM" value={blockEnd}
                              onChange={(event) => setBlockEnd(event.target.value)}
                              aria-invalid={blockError?.field === "range"}
                              aria-describedby={blockError?.field === "range" ? "block-range-error" : undefined}
                              className="rounded-lg border-white/20 bg-navy text-white" />
                          </label>
                        </div>
                        {blockError?.field === "range" && <p id="block-range-error" role="alert" className="mt-2 text-sm text-red-300">{blockError.message}</p>}
                      </div>
                    )}
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-40 flex-1 space-y-1">
                        <Label htmlFor="block-reason" className="text-mid">Reason (optional)</Label>
                        <Input id="block-reason" maxLength={250} value={blockReason}
                          onChange={(event) => setBlockReason(event.target.value)}
                          placeholder="e.g. Personal day" className="rounded-lg border-white/20 bg-navy text-white" />
                      </div>
                      <Button type="submit" disabled={!blockDate} className="rounded-lg bg-red-600 text-white hover:bg-red-700">
                        <Ban className="size-4" />
                        {blockSaving ? "Blocking…" : "Block time"}
                      </Button>
                    </div>
                  </fieldset>
                  {blockError?.field === "form" && <p role="alert" className="mt-3 text-sm text-red-300">{blockError.message}</p>}
                </form>

                {/* Current blocked slots */}
                {blockedSlots.length > 0 && (
                  <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Existing blocks</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {blockedSlots.map((slot) => (
                        <div key={slot.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-white">
                          <span>
                            {new Date(slot.blocked_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {slot.start_time ? ` ${formatRangeTime(slot.start_time)}–${formatRangeTime(slot.end_time!)}` : slot.blocked_time ? ` ${slot.blocked_time}` : " (all day)"}
                          </span>
                          {slot.reason && <span className="min-w-0 break-words text-mid">— {slot.reason}</span>}
                          <button
                            type="button"
                            aria-label={`Remove blocked time on ${slot.blocked_date}`}
                            title="Remove blocked time"
                            onClick={async () => { try { const result = await unblockSlot(slot.id); if (result.error) toast.error(result.error); else { await fetchBlocked(); toast.success("Time unblocked."); } } catch { toast.error("Could not remove this block."); } }}
                            className="ml-auto grid size-9 place-items-center rounded-lg border border-red-400/25 text-red-300 hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-cyan"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="history">
            {tab === "history" && <AppointmentHistory refreshKey={historyRevision} onOpen={(booking, name) => setSelectedEntry({ type: "booking", time: booking.booking_time, name, booking })} />}
          </TabsContent>

          {/* Shared appointment details for Calendar, History and Customers */}
          <Dialog open={!!selectedEntry} onOpenChange={(open) => {
            if (!open) {
              setSelectedEntry(null);
              setHistoryRevision(value => value + 1);
            }
          }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/15 bg-dark p-4 shadow-xl sm:max-w-2xl sm:p-6">
              {selectedEntry && appointment && (
                <>
                  <DialogHeader className="rounded-xl border border-cyan/20 bg-cyan/5 p-4 pr-9">
                    <p className="text-xs uppercase tracking-wider text-cyan">
                      {detailBooking ? "Booking details" : "Subscription details"}
                    </p>
                    <DialogTitle className="break-words text-2xl font-semibold text-white">{selectedEntry.name}</DialogTitle>
                    <DialogDescription className="text-mid">
                      {detailBooking?.booking_date || selectedEntry.occurrenceDate} · {selectedEntry.time} Calgary time
                    </DialogDescription>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-white">{PACKAGE_LABELS[appointment.package]} · {SERVICE_TYPE_LABELS[appointment.service_type]}</span>
                      <Badge variant="outline" className={detailBooking ? statusColors[detailBooking.status] : "border-cyan/30 text-cyan capitalize"}>
                        {detailBooking ? statusLabels[detailBooking.status] : detailSubscription?.status}
                      </Badge>
                    </div>
                  </DialogHeader>
                  <section className="space-y-2 rounded-xl border border-white/10 bg-navy/25 p-4">
                    <h3 className="font-semibold text-white">Customer &amp; vehicle</h3>
                    <p className="text-sm text-mid">{VEHICLE_LABELS[appointment.vehicle_size]} · {appointment.location === "mobile" ? "Mobile" : "In-shop"}</p>
                    {appointmentPhone && <p className="flex items-center gap-2 text-mid"><Phone className="size-4 shrink-0" />{appointmentPhone}</p>}
                    {detailBooking?.guest_email && <p className="flex items-center gap-2 break-all text-mid"><Mail className="size-4 shrink-0" />{detailBooking.guest_email}</p>}
                    {appointmentAddress && <p className="flex items-start gap-2 break-words text-mid"><MapPin className="size-4 shrink-0" /><span className="min-w-0">{appointmentAddress}</span></p>}
                  </section>
                  <section className="space-y-2 rounded-xl border border-white/10 bg-navy/25 p-4">
                    <h3 className="font-semibold text-white">Service &amp; add-ons</h3>
                    {detailBooking && <p className="text-mid">Booking estimate <span className="text-cyan">${detailBooking.total_estimate}</span></p>}
                    {detailSubscription && (
                      <p className="text-mid">
                        {SUBSCRIPTION_PLANS.find(plan => plan.id === detailSubscription.plan)?.name ?? detailSubscription.plan} · Every {detailSubscription.recurring_day} ·
                        <span className="ml-1 text-cyan">${dbGetSubPrice(detailSubscription.plan, detailSubscription.vehicle_size, detailSubscription.package)}/visit</span>
                      </p>
                    )}
                    {!!detailBooking?.addons?.length && (
                      <ul className="space-y-1 text-sm text-white">
                        {detailBooking.addons.map(addon => (
                          <li key={addon.id} className="flex justify-between gap-3">
                            <span>{addon.name}</span><span className="text-cyan">${addon.price}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  {detailBooking?.notes && (
                    <section className="space-y-2 rounded-xl border border-white/10 bg-navy/25 p-4">
                      <h3 className="font-semibold text-white">Booking notes</h3>
                      <p className="whitespace-pre-wrap break-words text-mid">{detailBooking.notes}</p>
                    </section>
                  )}
                  {detailBooking && (
                    <>
                      <section className="space-y-3 rounded-xl border border-white/10 bg-navy/25 p-4">
                        <h3 className="font-semibold text-white">Appointment status</h3>
                        <div className="flex flex-wrap gap-2">
                          {(["confirmed", "completed", "no_show"] as const).map(status => (
                            <Button key={status} variant="outline" size="sm"
                              disabled={detailBooking.status === status}
                              onClick={() => handleStatusChange(detailBooking.id, status)}
                              className={statusColors[status]}>
                              {statusLabels[status]}
                            </Button>
                          ))}
                        </div>
                      </section>
                      <BookingAdminTools key={detailBooking.id} booking={detailBooking}
                        onRescheduled={async () => {
                          await fetchBookings();
                          setSelectedEntry(null);
                          setHistoryRevision(value => value + 1);
                        }} />
                      <section className="border-t border-white/10 pt-4">
                        <Button variant="outline" disabled={detailBooking.status === "cancelled"}
                          className="border-red-400/30 text-red-300 hover:bg-red-400/10 hover:text-red-200"
                          onClick={() => {
                            setCancelBooking({
                              id: detailBooking.id,
                              name: selectedEntry.name,
                              date: detailBooking.booking_date,
                              time: detailBooking.booking_time,
                            });
                            setSelectedEntry(null);
                          }}>
                          Cancel booking
                        </Button>
                      </section>
                    </>
                  )}
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Cancel Booking Modal */}
          <Dialog open={!!cancelBooking} onOpenChange={(open) => !open && setCancelBooking(null)}>
            <DialogContent className="border-red-500/20 bg-[hsl(var(--card))] shadow-xl">
              <DialogHeader>
                <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  Cancel Booking
                </DialogTitle>
              </DialogHeader>
              {cancelBooking && (
                <div className="space-y-4 pt-2">
                  <p className="text-[hsl(var(--muted-foreground))]">
                    Are you sure you want to cancel <span className="text-white font-medium">{cancelBooking.name}&apos;s</span> booking?
                  </p>
                  <div className="rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-3">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-white">
                        <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                        {new Date(cancelBooking.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1 text-white">
                        <Clock className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                        {cancelBooking.time}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-red-400">The customer will be notified by email.</p>
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={async () => {
                        setCancelling(true);
                        await updateBookingStatus(cancelBooking.id, "cancelled");
                        setCancelBooking(null);
                        setCancelling(false);
                        setHistoryRevision(value => value + 1);
                        fetchBookings();
                      }}
                      disabled={cancelling}
                      className="flex-1 bg-red-600 font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-white hover:bg-red-700"
                    >
                      {cancelling ? "Cancelling..." : "Yes, Cancel Booking"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setCancelBooking(null)}
                      className="flex-1 border-[hsl(var(--muted-foreground))]/30 text-[hsl(var(--muted-foreground))] hover:text-white"
                    >
                      Keep Booking
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* ============ CUSTOMERS TAB ============ */}
          <TabsContent value="customers">
            <Card className="rounded-2xl border-white/15 bg-navy/25">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  Customers
                </CardTitle>
                <p className="text-sm text-mid">Find guest and registered customers, then open their appointment history.</p>
              </CardHeader>
              <CardContent>
                <Label htmlFor="customer-search" className="mb-2 text-mid">Search customers</Label>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <Input
                    id="customer-search"
                    type="search"
                    placeholder="Search by name, email, phone, or booking reference..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="rounded-lg border-white/20 bg-navy pl-10 text-white placeholder:text-mid"
                  />
                </div>

                <label className="mb-4 flex items-center gap-2 text-sm text-mid">
                  <input type="checkbox" className="size-4 accent-cyan" checked={includeArchivedCustomers} onChange={event => setIncludeArchivedCustomers(event.target.checked)} />
                  Include archived appointments
                </label>
                <p className="mb-4 text-xs text-mid">Guest bookings and existing accounts are grouped by email for your customer records.</p>
                {(() => {
                  const q = customerSearch.toLowerCase().trim();
                  const filtered = q ? customerRows.filter(customer => customer.search_text.includes(q)) : customerRows;

                  if (filtered.length === 0) {
                    return (
                      <p className="py-4 text-[hsl(var(--muted-foreground))]">
                        {q ? `No customers matching "${customerSearch}".` : "No customers found."}
                      </p>
                    );
                  }

                  return (
                    <ul className="space-y-3">
                      {filtered.map(customer => (
                        <li key={customer.id} className="rounded-xl border border-white/10 bg-dark/60 p-4">
                          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                            <div className="min-w-0">
                              <p className="break-words font-semibold text-white">{customer.first_name} {customer.last_name}</p>
                              <p className="mt-1 text-xs text-cyan">{customer.is_guest ? "Guest customer" : "Registered customer"}</p>
                            </div>
                            <div className="min-w-0 space-y-1 text-sm text-mid">
                              <p className="break-all">{customer.email || "No email on file"}</p>
                              <p>{customer.phone || "No phone on file"}</p>
                            </div>
                            <div className="text-sm text-mid">
                              <p>{customer.booking_ids.length} appointment{customer.booking_ids.length === 1 ? "" : "s"}</p>
                              <p className="text-xs">{customer.last_booking_date ? `Latest: ${format(new Date(customer.last_booking_date + "T12:00:00"), "MMM d, yyyy")}` : "No appointments yet"}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="mt-3 rounded-lg border-cyan/30 text-cyan"
                            aria-label={`View customer ${customer.first_name} ${customer.last_name}`}
                            onClick={() => setSelectedCustomerId(customer.id)}>
                            View customer
                          </Button>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Customer Detail Modal */}
            <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>
              <DialogContent className="max-h-[90dvh] overflow-y-auto border-white/15 bg-dark p-4 shadow-xl sm:max-w-2xl sm:p-6">
                <DialogHeader className="rounded-xl border border-cyan/20 bg-cyan/5 p-4 pr-9">
                  <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                    {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                  </DialogTitle>
                  <DialogDescription className="text-mid">
                    {selectedCustomer?.is_guest ? "Guest customer" : "Registered customer"}
                  </DialogDescription>
                </DialogHeader>
                {selectedCustomer && (
                  <div className="space-y-5 pt-2">
                    {/* Contact info */}
                    <section className="space-y-2 rounded-xl border border-white/10 bg-navy/25 p-4">
                      <h3 className="font-semibold text-white">Contact &amp; vehicle</h3>
                      {selectedCustomer.email && (
                        <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                          <Mail className="h-4 w-4" />
                          <span className="break-all">{selectedCustomer.email}</span>
                        </div>
                      )}
                      {selectedCustomer.phone && (
                        <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                          <Phone className="h-4 w-4" />
                          <span>{selectedCustomer.phone}</span>
                        </div>
                      )}
                      {!selectedCustomer.email && !selectedCustomer.phone && <p className="text-sm text-mid">No contact details on file.</p>}
                      {latestCustomerBooking && <p className="text-sm text-mid">Vehicle at latest appointment: {VEHICLE_LABELS[latestCustomerBooking.vehicle_size]}</p>}
                    </section>

                    {/* Booking History */}
                    {(() => {
                      const userBookings = bookings
                        .filter((b) => selectedCustomer.booking_ids.includes(b.id))
                        .sort((a, b) => b.booking_date.localeCompare(a.booking_date));
                      return (
                        <div className="space-y-3">
                          <p className="text-xs uppercase tracking-wider text-[hsl(var(--accent))] font-semibold">
                            Appointments ({userBookings.length})
                          </p>
                          {userBookings.length === 0 ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No appointments yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {userBookings.map((b) => (
                                <div key={b.id} className="rounded-xl border border-white/10 bg-navy/25 p-4">
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-white font-medium text-sm">
                                      {new Date(b.booking_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {b.booking_time}
                                    </span>
                                    <Badge variant="outline" className={statusColors[b.status]}>
                                      {statusLabels[b.status]}
                                    </Badge>
                                  </div>
                                  <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                                    <span>{PACKAGE_LABELS[b.package]}</span>
                                    <span>{SERVICE_TYPE_LABELS[b.service_type]}</span>
                                    <span>{VEHICLE_LABELS[b.vehicle_size]}</span>
                                    <span className="text-[hsl(var(--accent))] font-semibold">${b.total_estimate}</span>
                                    {b.promo_code && (
                                      <span className="text-cyan">Promo: {b.promo_code} ({b.promo_discount_pct}% off)</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                                    Ref: {b.reference_code}{b.archived_at ? " · Archived" : ""}
                                  </div>
                                  <Button variant="outline" size="sm" className="mt-3 text-cyan border-cyan/30" onClick={() => {
                                    setSelectedEntry({ type: "booking", time: b.booking_time, name: `${selectedCustomer.first_name} ${selectedCustomer.last_name}`.trim(), booking: b });
                                    setSelectedCustomerId(null);
                                  }}>View booking details</Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {!selectedCustomer.is_guest && (<>
                    <section className="space-y-3" aria-label="Customer subscriptions">
                      <h3 className="font-semibold text-white">Subscriptions</h3>
                      {customerSubscriptions.length === 0 ? (
                        <p className="text-sm text-mid">No active or paused subscriptions.</p>
                      ) : (
                        <ul className="space-y-3">
                          {customerSubscriptions.map(subscription => (
                            <SubscriptionCard key={subscription.id} subscription={subscription}
                              price={dbGetSubPrice(subscription.plan, subscription.vehicle_size, subscription.package)} />
                          ))}
                        </ul>
                      )}
                    </section>

                    {/* Referral Info */}
                    <div className="space-y-3 rounded-xl border border-white/10 bg-navy/25 p-4">
                      <h3 className="flex items-center gap-2 font-semibold text-white">
                        <Gift className="size-4 text-cyan" /> Referrals
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Referral Code</p>
                          <p className="font-mono font-bold text-white tracking-[3px]">{selectedCustomer.referral_code ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Credits</p>
                          <p className="text-white font-bold text-lg">
                            {selectedCustomer.referral_credits ?? 0}
                            <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]"> / 3 = free detail</span>
                          </p>
                        </div>
                      </div>
                      {(selectedCustomer.referral_credits ?? 0) >= 3 && (
                        <Button
                          size="sm"
                          disabled={confirmBusy}
                          onClick={() => {
                            const customerId = selectedCustomer.id;
                            showConfirm({
                              title: "Redeem Credits",
                              description: `Redeem 3 credits for ${selectedCustomer.first_name}? These credits count toward a free Premium Detail.`,
                              confirmLabel: "Redeem",
                              onConfirm: async () => {
                                setConfirmBusy(true);
                                try {
                                  const { error } = await supabase.rpc("redeem_referral_credits", { user_id_input: customerId });
                                  setConfirmModal((m) => ({ ...m, open: false }));
                                  if (error) {
                                    toast.error(error.message);
                                  } else {
                                    toast.success("3 credits redeemed!");
                                    await fetchProfiles();
                                  }
                                } catch (e) {
                                  setConfirmModal((m) => ({ ...m, open: false }));
                                  toast.error("Failed to redeem credits.");
                                  console.error(e);
                                } finally {
                                  setConfirmBusy(false);
                                }
                              },
                            });
                          }}
                          className="h-auto whitespace-normal rounded-lg bg-cyan text-navy hover:bg-cyan/90"
                        >
                          <Gift className="mr-2 h-3.5 w-3.5" />
                          Redeem 3 Credits — Free Premium Detail
                        </Button>
                      )}
                    </div>

                    </>)}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ============ SUBSCRIPTIONS TAB ============ */}
          <TabsContent value="subscriptions">
            <Card className="rounded-2xl border-white/15 bg-navy/25">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  Active Subscriptions
                </CardTitle>
                <p className="text-sm text-mid">Compare recurring plans, per-visit prices and upcoming visits. Schedules use Calgary time.</p>
              </CardHeader>
              <CardContent>
                {activeSubscriptions.length === 0 ? (
                  <p className="py-4 text-mid">No active subscriptions.</p>
                ) : (
                  <ul className="space-y-3">
                    {activeSubscriptions.map(subscription => (
                      <SubscriptionCard key={subscription.id} subscription={subscription}
                        customerName={subscription.profiles ? `${subscription.profiles.first_name} ${subscription.profiles.last_name}` : "Unknown customer"}
                        price={dbGetSubPrice(subscription.plan, subscription.vehicle_size, subscription.package)} />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ PROMOS TAB ============ */}
          <TabsContent value="promos" className="space-y-6">
            <Card className="rounded-2xl border-white/15 bg-navy/25">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">Create promo code</CardTitle>
                <p className="text-sm text-mid">Set the discount and how often customers can use the code.</p>
              </CardHeader>
              <CardContent>
                <form
                  aria-label="Create promo code"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (promoSaving) return;
                    setPromoFormError("");
                    setPromoSaving(true);
                    try {
                      const result = await createPromoCode(promoForm);
                      if (result.error) {
                        setPromoFormError(result.error);
                        return;
                      }
                      setPromoForm({ code: "", discount_pct: 10, scope: "booking", usage_limit: "unlimited", active: true });
                      await fetchPromoCodes();
                    } catch {
                      setPromoFormError("Could not create the promo code. Please try again.");
                    } finally {
                      setPromoSaving(false);
                    }
                  }}
                >
                  <fieldset disabled={promoSaving} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1 text-sm text-mid">
                      Code
                      <Input required value={promoForm.code} placeholder="SUMMER25"
                        onChange={event => setPromoForm({ ...promoForm, code: event.target.value.toUpperCase() })}
                        className="rounded-lg border-white/20 bg-navy text-white uppercase" />
                    </label>
                    <label className="space-y-1 text-sm text-mid">
                      Discount (%)
                      <Input required type="number" min={1} max={100} value={promoForm.discount_pct}
                        onChange={event => setPromoForm({ ...promoForm, discount_pct: Number(event.target.value) })}
                        className="rounded-lg border-white/20 bg-navy text-white" />
                    </label>
                    <div className="space-y-1 text-sm text-mid">
                      <Label htmlFor="promo-scope">Scope</Label>
                      <select id="promo-scope" value={promoForm.scope}
                        onChange={event => setPromoForm({ ...promoForm, scope: event.target.value as "booking" | "subscription" })}
                        className="block h-9 w-full rounded-lg border border-white/20 bg-navy px-3 text-white">
                        <option value="booking">One-time booking</option>
                        <option value="subscription" disabled>Subscription (paused)</option>
                      </select>
                    </div>
                    <div className="space-y-1 text-sm text-mid">
                      <Label htmlFor="promo-use-limit">Use limit</Label>
                      <select id="promo-use-limit" value={promoForm.usage_limit}
                        onChange={event => setPromoForm({ ...promoForm, usage_limit: event.target.value as PromoUsageLimit })}
                        className="block h-9 w-full rounded-lg border border-white/20 bg-navy px-3 text-white">
                        {PROMO_LIMITS.map(limit => <option key={limit} value={limit}>{PROMO_LIMIT_LABELS[limit]}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4">
                      <Button type="submit" className="rounded-lg bg-cyan text-navy hover:bg-cyan/90">
                        {promoSaving ? "Creating…" : "Create code"}
                      </Button>
                    </div>
                  </fieldset>
                  {promoFormError && <p role="alert" className="mt-3 text-sm text-red-300">{promoFormError}</p>}
                </form>
                <p className="mt-4 text-xs text-mid">Booking limits work without an account. Email matching ignores case and surrounding spaces. A use counts when a booking is saved, including bookings later cancelled or archived. Changing a limit preserves earlier uses.</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-white/15 bg-navy/25">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">Existing promo codes</CardTitle>
                <p className="text-sm text-mid">Discount edits apply to future bookings and subscriptions. Discount fields save when you leave them.</p>
              </CardHeader>
              <CardContent>
                {promoCodes.length === 0 ? (
                  <p className="py-4 text-mid">No promo codes yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {promoCodes.map(promo => (
                      <li key={promo.id} className="space-y-4 rounded-xl border border-white/10 bg-dark/60 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words font-mono font-semibold tracking-wider text-white">{promo.code}</p>
                            <p className="mt-1 text-sm text-mid">{promo.scope === "booking" ? "One-time booking" : "Subscription"}</p>
                          </div>
                          <Badge variant="outline" className={promo.active ? "border-green-400/30 text-green-400" : "border-white/20 text-mid"}>
                            {promo.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,16rem)]">
                          <label className="space-y-1 text-sm text-mid">
                            Discount (%)
                            <Input key={promo.discount_pct} aria-label={`Discount for ${promo.code}`} type="number" min={1} max={100}
                              defaultValue={promo.discount_pct} className="rounded-lg border-white/20 bg-navy text-white"
                              onBlur={async (event) => {
                                const input = event.currentTarget;
                                const discount = Number(input.value);
                                if (discount === promo.discount_pct) return;
                                if (!Number.isInteger(discount) || discount < 1 || discount > 100) {
                                  toast.error("Enter a whole discount from 1 to 100.");
                                  input.value = String(promo.discount_pct);
                                  return;
                                }
                                if (!await savePromoChange(promo.id, { discount_pct: discount })) {
                                  input.value = String(promo.discount_pct);
                                }
                              }} />
                          </label>
                          {promo.scope === "booking" ? (
                            <label className="space-y-1 text-sm text-mid">
                              Use limit
                              <select aria-label={`Use limit for ${promo.code}`} value={promo.usage_limit}
                                className="block h-9 w-full rounded-lg border border-white/20 bg-navy px-3 text-white disabled:opacity-50"
                                disabled={!!promoLimitSaving}
                                onChange={async (event) => {
                                  const limit = event.target.value as PromoUsageLimit;
                                  setPromoLimitSaving(promo.id);
                                  try {
                                    if (await savePromoChange(promo.id, { usage_limit: limit })) toast.success("Promo use limit updated.");
                                  } finally {
                                    setPromoLimitSaving(null);
                                  }
                                }}>
                                {PROMO_LIMITS.map(limit => <option key={limit} value={limit}>{PROMO_LIMIT_LABELS[limit]}</option>)}
                              </select>
                            </label>
                          ) : (
                            <div className="text-sm text-mid">
                              <p>Use limit</p>
                              <p className="mt-2 text-white">{promo.max_uses_per_user === null ? "Unlimited" : "Legacy account limit"}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                          <Button type="button" variant="outline" size="sm"
                            className="rounded-lg border-cyan/30 text-cyan"
                            onClick={() => savePromoChange(promo.id, { active: !promo.active })}>
                            {promo.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="rounded-lg border-red-400/30 text-red-300 hover:bg-red-400/10"
                            aria-label={`Delete promo code ${promo.code}`}
                            onClick={() => showConfirm({
                              title: "Delete Promo Code",
                              description: `Delete promo code ${promo.code}? This cannot be undone.`,
                              confirmLabel: "Delete",
                              variant: "destructive",
                              onConfirm: async () => {
                                setConfirmBusy(true);
                                try {
                                  const result = await deletePromoCode(promo.id);
                                  if (result.error) toast.error(result.error);
                                  else {
                                    toast.success("Promo code deleted.");
                                    await fetchPromoCodes();
                                  }
                                } catch {
                                  toast.error("Could not delete this promo code. Please try again.");
                                } finally {
                                  setConfirmModal(modal => ({ ...modal, open: false }));
                                  setConfirmBusy(false);
                                }
                              },
                            })}>
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ TEAM TAB (owner only) ============ */}
          {isOwner && (
            <TabsContent value="team" className="space-y-6">
              <Card className="rounded-2xl border-white/15 bg-navy/25">
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">Add admin</CardTitle>
                  <p className="text-sm text-mid">Enter the email address the person used to sign up for their Calgary account.</p>
                </CardHeader>
                <CardContent>
                  <form aria-label="Add admin" onSubmit={async (event) => {
                    event.preventDefault();
                    if (addingAdmin) return;
                    const input = event.currentTarget.elements.namedItem("admin_email") as HTMLInputElement;
                    const email = input.value.trim();
                    if (!email) return;
                    setTeamFormError("");
                    setAddingAdmin(true);
                    try {
                      const { updateUserRole } = await import("./actions");
                      const result = await updateUserRole(email, "admin");
                      if (result.error) {
                        setTeamFormError(result.error);
                        return;
                      }
                      input.value = "";
                      toast.success("Admin access granted.");
                      await fetchProfiles();
                    } catch {
                      setTeamFormError("Could not grant admin access. Please try again.");
                    } finally {
                      setAddingAdmin(false);
                    }
                  }}>
                    <fieldset disabled={addingAdmin} className="flex flex-wrap items-end gap-3">
                      <label className="min-w-0 basis-full space-y-1 text-sm text-mid sm:max-w-md sm:flex-1">
                        Signup email
                        <Input name="admin_email" type="email" required placeholder="user@example.com"
                          className="rounded-lg border-white/20 bg-navy text-white" />
                      </label>
                      <Button type="submit" className="rounded-lg bg-cyan text-navy hover:bg-cyan/90">
                        <Shield className="size-4" />
                        {addingAdmin ? "Granting access…" : "Grant admin access"}
                      </Button>
                    </fieldset>
                    {teamFormError && <p role="alert" className="mt-3 text-sm text-red-300">{teamFormError}</p>}
                  </form>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-white/15 bg-navy/25">
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">Team members</CardTitle>
                  <p className="text-sm text-mid">Owners manage team access. Admins can work in the Calgary dashboard.</p>
                </CardHeader>
                <CardContent>
                  {teamMembers.length === 0 ? (
                    <p className="py-4 text-mid">No team members found.</p>
                  ) : (
                    <ul className="space-y-3">
                      {teamMembers.map(member => (
                        <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-dark/60 p-4">
                          <div className="min-w-0 space-y-2">
                            <p className="break-words font-semibold text-white">{member.first_name} {member.last_name}</p>
                            <Badge variant="outline" className={member.role === "owner" ? "border-yellow/30 text-yellow" : "border-cyan/30 text-cyan"}>
                              {member.role === "owner" ? <ShieldCheck className="size-3" /> : <Shield className="size-3" />}
                              <span className="capitalize">{member.role}</span>
                            </Badge>
                          </div>
                          {member.role === "admin" && (
                            <Button variant="outline" size="sm" className="rounded-lg border-red-400/30 text-red-300 hover:bg-red-400/10"
                              aria-label={`Revoke admin access for ${member.first_name} ${member.last_name}`}
                              onClick={() => showConfirm({
                                title: "Revoke admin access",
                                description: `Remove admin access from ${member.first_name} ${member.last_name}?`,
                                confirmLabel: "Revoke",
                                variant: "destructive",
                                onConfirm: async () => {
                                  setConfirmBusy(true);
                                  try {
                                    const { revokeAdmin } = await import("./actions");
                                    const result = await revokeAdmin(member.id);
                                    if (result.error) toast.error(result.error);
                                    else {
                                      toast.success("Admin access revoked.");
                                      await fetchProfiles();
                                    }
                                  } catch {
                                    toast.error("Could not revoke admin access. Please try again.");
                                  } finally {
                                    setConfirmModal(modal => ({ ...modal, open: false }));
                                    setConfirmBusy(false);
                                  }
                                },
                              })}>
                              Revoke access
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <ConfirmModal
        loading={confirmBusy}
        open={confirmModal.open}
        onOpenChange={(open) => { if (!confirmBusy) setConfirmModal((m) => ({ ...m, open })); }}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}



