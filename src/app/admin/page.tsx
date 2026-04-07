"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateBookingStatus, blockTimeSlot, unblockSlot, getBlockedSlots } from "./actions";
import { TIME_SLOTS } from "@/lib/constants";
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
import { addWeeks, differenceInCalendarWeeks, addDays, startOfDay, format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Calendar,
  Users,
  Clock,
  Car,
  Shield,
  ShieldCheck,
  UserCog,
  Sparkles,
  MapPin,
  Phone,
  Mail,
  User,
  Ban,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  PACKAGE_LABELS,
  VEHICLE_LABELS,
  SERVICE_TYPE_LABELS,
  SUBSCRIPTION_PLANS,
  getPrice,
  type BookingStatus,
  type PackageId,
  type VehicleSize,
  type ServiceType,
  type SubscriptionStatus,
} from "@/lib/constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BookingAddon {
  id: string;
  name: string;
  price: number;
}

interface Booking {
  id: string;
  user_id: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_address: string | null;
  service_address: string | null;
  booking_date: string;
  booking_time: string;
  package: PackageId;
  service_type: ServiceType;
  vehicle_size: VehicleSize;
  location: string;
  status: BookingStatus;
  reference_code: string;
  total_estimate: number;
  addons: BookingAddon[];
  notes: string | null;
  profiles?: { first_name: string; last_name: string; phone: string } | null;
}

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  email?: string;
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

export default function AdminPage() {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  const [tab, setTab] = useState("calendar");
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);

  // Data state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // Current user role
  const [currentUserRole, setCurrentUserRole] = useState<string>("admin");
  const isOwner = currentUserRole === "owner";

  // Team management state
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);

  // Blocked slots
  const [blockedSlots, setBlockedSlots] = useState<{ id: string; blocked_date: string; blocked_time: string | null; reason: string | null }[]>([]);
  const [blockDate, setBlockDate] = useState("");
  const [blockTime, setBlockTime] = useState<string>("");
  const [blockReason, setBlockReason] = useState("");
  const [blockWholeDay, setBlockWholeDay] = useState(false);

  // Upcoming visits filter
  const [visitFilter, setVisitFilter] = useState<"3days" | "week">("3days");

  // Cancel booking modal
  const [cancelBooking, setCancelBooking] = useState<{ id: string; name: string; date: string; time: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Customer detail modal
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null);

  /* ---- Data fetching ---- */

  const fetchBookings = useCallback(async () => {
    const todayStr = new Date().toLocaleDateString("en-CA");

    const [{ data: allData }, { data: upcomingData }] = await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true }),
      supabase
        .from("bookings")
        .select("*")
        .gte("booking_date", todayStr)
        .in("status", ["confirmed"])
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true }),
    ]);

    setBookings((allData as Booking[]) ?? []);
    setAllBookings((upcomingData as Booking[]) ?? []);
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

    setProfiles((profileRes.data as Profile[]) ?? []);
    setSubscriptions(subsWithProfiles as Subscription[]);
    setTeamMembers((teamRes.data as Profile[]) ?? []);
  }, [supabase]);

  const fetchBlocked = useCallback(async () => {
    const data = await getBlockedSlots();
    setBlockedSlots(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCurrentUser(),
      fetchBookings(),
      fetchProfiles(),
      fetchBlocked(),
    ]).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch data when switching tabs
  useEffect(() => {
    fetchBookings();
    fetchProfiles();
    fetchBlocked();
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
  }

  function getSubscriptionsForUser(userId: string): Subscription[] {
    return subscriptions.filter((s) => s.user_id === userId && ["active", "paused"].includes(s.status));
  }

  /* ---- FullCalendar events ---- */

  const calendarEvents = useMemo((): EventInput[] => {
    const events: EventInput[] = [];

    // Bookings
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const time24 = parseTimeTo24(b.booking_time);
      const name = getBookingName(b);
      events.push({
        id: `booking-${b.id}`,
        title: `${b.booking_time} ${name}`,
        start: `${b.booking_date}T${time24}:00`,
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
      if (!bl.blocked_time) {
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
        const time24 = parseTimeTo24(bl.blocked_time);
        events.push({
          id: `blocked-${bl.id}`,
          title: `${bl.blocked_time} — ${bl.reason || "Blocked"}`,
          start: `${bl.blocked_date}T${time24}:00`,
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
      });
    }
  }

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
        <h1 className="font-[family-name:var(--font-heading)] text-4xl uppercase tracking-wide text-white">
          Admin Dashboard
        </h1>

        {/* Upcoming Visits */}
        {(() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayStr = today.toLocaleDateString("en-CA");

          // Compute cutoff date
          const cutoff = new Date(today);
          cutoff.setDate(cutoff.getDate() + (visitFilter === "3days" ? 3 : 7));
          const cutoffStr = cutoff.toLocaleDateString("en-CA");

          type Visit = {
            id: string;
            type: "booking" | "subscription";
            date: string;
            time: string;
            name: string;
            email?: string;
            packageKey: PackageId;
            serviceTypeKey: ServiceType;
            vehicleSizeKey: VehicleSize;
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
                name, email: b.guest_email || undefined,
                packageKey: b.package, serviceTypeKey: b.service_type, vehicleSizeKey: b.vehicle_size,
                price: b.total_estimate, phone,
              });
            }
          }

          for (const s of subscriptions) {
            if (s.status === "active" && s.next_service_date && s.next_service_date >= todayStr && s.next_service_date <= cutoffStr) {
              const name = s.profiles ? `${s.profiles.first_name} ${s.profiles.last_name}` : "Unknown";
              visits.push({
                id: s.id, type: "subscription", date: s.next_service_date, time: s.recurring_time,
                name, packageKey: s.package, serviceTypeKey: s.service_type, vehicleSizeKey: s.vehicle_size,
                price: getPrice(s.package, s.vehicle_size, s.service_type), phone: s.profiles?.phone || undefined,
              });
            }
          }

          visits.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time));

          return (
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                    <Clock className="h-5 w-5 text-yellow" />
                    Upcoming Visits
                  </CardTitle>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setVisitFilter("3days")}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        visitFilter === "3days"
                          ? "bg-yellow text-[#0b1740]"
                          : "bg-[hsl(var(--background))] border border-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white"
                      }`}
                    >
                      3 Days
                    </button>
                    <button
                      onClick={() => setVisitFilter("week")}
                      className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                        visitFilter === "week"
                          ? "bg-yellow text-[#0b1740]"
                          : "bg-[hsl(var(--background))] border border-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white"
                      }`}
                    >
                      Week
                    </button>
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
                            isNext ? "border-yellow/40 bg-yellow/5" : "border-[hsl(var(--muted))] bg-[hsl(var(--background))]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            {isNext && (
                              <Badge variant="outline" className="bg-yellow/15 text-yellow border-yellow/30 text-xs">Next</Badge>
                            )}
                            <Badge variant="outline" className={
                              visit.type === "subscription"
                                ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))] border-[hsl(var(--accent))]/30 text-xs"
                                : "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30 text-xs"
                            }>
                              {visit.type === "subscription" ? "Sub" : "Booking"}
                            </Badge>
                            <span className={`text-sm font-medium ${isNext ? "text-yellow" : "text-white"}`}>
                              {new Date(visit.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </span>
                            <span className={`text-sm ${isNext ? "text-yellow" : "text-[hsl(var(--muted-foreground))]"}`}>{visit.time}</span>
                            <span className="text-sm text-white font-medium">{visit.name}</span>
                            <span className="text-xs text-[hsl(var(--muted-foreground))]">{PACKAGE_LABELS[visit.packageKey]}</span>
                            {visit.phone && <span className="text-xs text-[hsl(var(--muted-foreground))]">{visit.phone}</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[hsl(var(--accent))]">${visit.price}</span>
                            {visit.type === "booking" && (
                              <button
                                onClick={() => setCancelBooking({
                                  id: visit.id, name: visit.name, date: visit.date, time: visit.time,
                                })}
                                className="text-red-400 hover:text-red-300 transition-colors"
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
          <TabsList className="bg-[hsl(var(--muted))]">
            <TabsTrigger value="calendar" className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider">
              <Calendar className="mr-2 h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="customers" className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider">
              <Users className="mr-2 h-4 w-4" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider">
              <Sparkles className="mr-2 h-4 w-4" />
              Subscriptions
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger value="team" className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider">
                <UserCog className="mr-2 h-4 w-4" />
                Team
              </TabsTrigger>
            )}
          </TabsList>

          {/* ============ CALENDAR TAB ============ */}
          <TabsContent value="calendar" className="space-y-6">
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardContent className="pt-6">
                <div className="fc-dark-theme">
                  <FullCalendar
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                      left: "prev,next today",
                      center: "title",
                      right: "dayGridMonth,timeGridWeek,timeGridDay",
                    }}
                    events={calendarEvents}
                    eventClick={handleEventClick}
                    height="auto"
                    eventDisplay="block"
                    dayMaxEvents={3}
                    nowIndicator={true}
                  />
                </div>
                {/* Legend */}
                <div className="flex items-center gap-4 mt-4 text-xs text-[hsl(var(--muted-foreground))]">
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
              </CardContent>
            </Card>

            {/* Block Time */}
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-heading)] text-xl uppercase tracking-wide text-white">
                  <Ban className="h-5 w-5 text-red-400" />
                  Block Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-[hsl(var(--muted-foreground))]">Date</Label>
                    <Input
                      type="date"
                      value={blockDate}
                      onChange={(e) => setBlockDate(e.target.value)}
                      className="h-9 w-40 border-[hsl(var(--muted))] bg-[hsl(var(--background))] text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[hsl(var(--muted-foreground))]">Time (or whole day)</Label>
                    <div className="flex items-center gap-2">
                      {!blockWholeDay && (
                        <div className="flex flex-wrap gap-1">
                          {TIME_SLOTS.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setBlockTime(t)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                                blockTime === t
                                  ? "bg-red-500 text-white"
                                  : "bg-[hsl(var(--background))] border border-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => { setBlockWholeDay(!blockWholeDay); setBlockTime(""); }}
                        className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                          blockWholeDay
                            ? "bg-red-500 text-white"
                            : "bg-[hsl(var(--background))] border border-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-white"
                        }`}
                      >
                        Whole Day
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1 flex-1 min-w-[120px]">
                    <Label className="text-xs text-[hsl(var(--muted-foreground))]">Reason (optional)</Label>
                    <Input
                      type="text"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="e.g. Personal day"
                      className="h-9 border-[hsl(var(--muted))] bg-[hsl(var(--background))] text-white placeholder:text-[hsl(var(--muted-foreground))]"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!blockDate) return;
                      if (!blockWholeDay && !blockTime) return;
                      await blockTimeSlot({
                        date: blockDate,
                        time: blockWholeDay ? undefined : blockTime,
                        reason: blockReason || undefined,
                      });
                      setBlockDate("");
                      setBlockTime("");
                      setBlockReason("");
                      setBlockWholeDay(false);
                      fetchBlocked();
                      fetchBookings();
                    }}
                    disabled={!blockDate || (!blockWholeDay && !blockTime)}
                    className="h-9 bg-red-600 text-white hover:bg-red-700 font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-xs"
                  >
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    Block
                  </Button>
                </div>

                {/* Current blocked slots */}
                {blockedSlots.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Currently Blocked</p>
                    <div className="flex flex-wrap gap-2">
                      {blockedSlots.map((slot) => (
                        <div key={slot.id} className="flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-400">
                          <span>
                            {new Date(slot.blocked_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {slot.blocked_time ? ` ${slot.blocked_time}` : " (all day)"}
                          </span>
                          {slot.reason && <span className="text-red-400/60">— {slot.reason}</span>}
                          <button
                            onClick={async () => { await unblockSlot(slot.id); fetchBlocked(); }}
                            className="ml-1 text-red-400 hover:text-white"
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

            {/* Entry detail modal */}
            <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
              <DialogContent className="border-[hsl(var(--accent))]/20 bg-[hsl(var(--card))] shadow-xl">
                <DialogHeader>
                  <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                    {selectedEntry?.type === "subscription" ? "Subscription Details" : "Booking Details"}
                  </DialogTitle>
                </DialogHeader>
                {selectedEntry && (
                  <div className="space-y-4 pt-2">
                    {/* Customer info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-white">
                        <User className="h-4 w-4 text-[hsl(var(--accent))]" />
                        <span className="font-semibold">{selectedEntry.name}</span>
                      </div>
                      {(() => {
                        const phone = selectedEntry.type === "subscription"
                          ? selectedEntry.subscription?.profiles?.phone
                          : selectedEntry.booking?.profiles?.phone || selectedEntry.booking?.guest_phone;
                        return phone ? (
                          <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                            <Phone className="h-4 w-4" />
                            <span>{phone}</span>
                          </div>
                        ) : null;
                      })()}
                      {selectedEntry.type === "booking" && selectedEntry.booking?.guest_email && (
                        <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                          <Mail className="h-4 w-4" />
                          <span>{selectedEntry.booking.guest_email}</span>
                        </div>
                      )}
                      {(() => {
                        const address = selectedEntry.type === "subscription"
                          ? selectedEntry.subscription?.service_address
                          : selectedEntry.booking?.service_address || selectedEntry.booking?.guest_address;
                        return address ? (
                          <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                            <MapPin className="h-4 w-4" />
                            <span>{address}</span>
                          </div>
                        ) : null;
                      })()}
                    </div>

                    {/* Service info */}
                    <div className="rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Time</p>
                          <p className="text-white">{selectedEntry.time}</p>
                        </div>
                        <div>
                          <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Package</p>
                          <p className="text-white">
                            {PACKAGE_LABELS[selectedEntry.type === "subscription" ? selectedEntry.subscription!.package : selectedEntry.booking!.package]}
                          </p>
                        </div>
                        <div>
                          <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Service</p>
                          <p className="text-white">
                            {SERVICE_TYPE_LABELS[selectedEntry.type === "subscription" ? selectedEntry.subscription!.service_type : selectedEntry.booking!.service_type]}
                          </p>
                        </div>
                        <div>
                          <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Vehicle</p>
                          <p className="text-white">
                            {VEHICLE_LABELS[selectedEntry.type === "subscription" ? selectedEntry.subscription!.vehicle_size : selectedEntry.booking!.vehicle_size]}
                          </p>
                        </div>
                        <div>
                          <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Location</p>
                          <p className="text-white">
                            {(selectedEntry.type === "subscription" ? selectedEntry.subscription!.location : selectedEntry.booking!.location) === "mobile" ? "Mobile" : "In-Shop"}
                          </p>
                        </div>
                        {selectedEntry.type === "subscription" && (
                          <div>
                            <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Plan</p>
                            <p className="text-white">
                              {SUBSCRIPTION_PLANS.find((p) => p.id === selectedEntry.subscription!.plan)?.name ?? selectedEntry.subscription!.plan}
                            </p>
                          </div>
                        )}
                        {selectedEntry.type === "subscription" && (
                          <div>
                            <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Schedule</p>
                            <p className="text-white">
                              Every {selectedEntry.subscription!.recurring_day}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Price</p>
                          <p className="text-[hsl(var(--accent))] font-semibold">
                            {selectedEntry.type === "booking"
                              ? `$${selectedEntry.booking!.total_estimate}`
                              : `$${getPrice(selectedEntry.subscription!.package, selectedEntry.subscription!.vehicle_size, selectedEntry.subscription!.service_type)}/visit`
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Addons */}
                    {selectedEntry.type === "booking" && (selectedEntry.booking?.addons?.length ?? 0) > 0 && (
                      <div className="rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-3">
                        <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider mb-2">Add-Ons</p>
                        <div className="space-y-1">
                          {selectedEntry.booking!.addons.map((addon: BookingAddon) => (
                            <div key={addon.id} className="flex items-center justify-between text-sm">
                              <span className="text-white">{addon.name}</span>
                              <span className="text-[hsl(var(--accent))]">${addon.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedEntry.type === "booking" && selectedEntry.booking?.notes && (
                      <div className="rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-3">
                        <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider mb-1">Notes</p>
                        <p className="text-white text-sm">{selectedEntry.booking.notes}</p>
                      </div>
                    )}

                    {/* Booking status change */}
                    {selectedEntry.type === "booking" && selectedEntry.booking && (
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Update Status</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(["confirmed", "completed", "no_show"] as BookingStatus[]).map((s) => (
                            <Button
                              key={s}
                              variant="outline"
                              size="sm"
                              disabled={selectedEntry.booking!.status === s}
                              onClick={() => handleStatusChange(selectedEntry.booking!.id, s)}
                              className={`${statusColors[s]} ${selectedEntry.booking!.status === s ? "opacity-50" : ""}`}
                            >
                              {statusLabels[s]}
                            </Button>
                          ))}
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={selectedEntry.booking!.status === "cancelled"}
                            onClick={() => {
                              setCancelBooking({
                                id: selectedEntry.booking!.id,
                                name: selectedEntry.name,
                                date: selectedEntry.booking!.booking_date,
                                time: selectedEntry.booking!.booking_time,
                              });
                              setSelectedEntry(null);
                            }}
                            className={`${statusColors.cancelled} ${selectedEntry.booking!.status === "cancelled" ? "opacity-50" : ""}`}
                          >
                            Cancel Booking
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

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
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profiles.length === 0 ? (
                  <p className="py-4 text-[hsl(var(--muted-foreground))]">No customers found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-[hsl(var(--muted))]">
                          <TableHead className="text-[hsl(var(--muted-foreground))]">Name</TableHead>
                          <TableHead className="text-[hsl(var(--muted-foreground))]">Phone</TableHead>
                          <TableHead className="text-[hsl(var(--muted-foreground))]">Subscriptions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {profiles.map((p) => {
                          const userSubs = getSubscriptionsForUser(p.id);
                          return (
                            <TableRow
                              key={p.id}
                              className="border-[hsl(var(--muted))] cursor-pointer hover:bg-[hsl(var(--muted))]/30 transition-colors"
                              onClick={() => setSelectedCustomer(p)}
                            >
                              <TableCell className="font-medium text-white">{p.first_name} {p.last_name}</TableCell>
                              <TableCell className="text-[hsl(var(--muted-foreground))]">{p.phone || "N/A"}</TableCell>
                              <TableCell>
                                {userSubs.length > 0 ? (
                                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                                    {userSubs.length} Active
                                  </Badge>
                                ) : (
                                  <span className="text-[hsl(var(--muted-foreground))]">None</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customer Detail Modal */}
            <Dialog open={!!selectedCustomer} onOpenChange={(open) => !open && setSelectedCustomer(null)}>
              <DialogContent className="border-[hsl(var(--accent))]/20 bg-[#0b1740] shadow-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                    {selectedCustomer?.first_name} {selectedCustomer?.last_name}
                  </DialogTitle>
                </DialogHeader>
                {selectedCustomer && (
                  <div className="space-y-5 pt-2">
                    {/* Contact info */}
                    <div className="space-y-2">
                      {selectedCustomer.phone && (
                        <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
                          <Phone className="h-4 w-4" />
                          <span>{selectedCustomer.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Subscriptions */}
                    {(() => {
                      const userSubs = getSubscriptionsForUser(selectedCustomer.id);
                      return (
                        <div className="space-y-3">
                          <p className="text-xs uppercase tracking-wider text-[hsl(var(--accent))] font-semibold">
                            Subscriptions ({userSubs.length})
                          </p>
                          {userSubs.length === 0 ? (
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">No active subscriptions.</p>
                          ) : (
                            userSubs.map((sub) => {
                              const planLabel = SUBSCRIPTION_PLANS.find((pl) => pl.id === sub.plan)?.name ?? sub.plan;
                              return (
                                <div key={sub.id} className="rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-medium">{PACKAGE_LABELS[sub.package]}</span>
                                      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                        {planLabel}
                                      </Badge>
                                    </div>
                                    <span className="font-[family-name:var(--font-barlow-condensed)] text-lg font-bold text-[hsl(var(--accent))]">
                                      ${getPrice(sub.package, sub.vehicle_size, sub.service_type)}<span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">/visit</span>
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Service</p>
                                      <p className="text-white">{SERVICE_TYPE_LABELS[sub.service_type]}</p>
                                    </div>
                                    <div>
                                      <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Vehicle</p>
                                      <p className="text-white">{VEHICLE_LABELS[sub.vehicle_size]}</p>
                                    </div>
                                    <div>
                                      <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Schedule</p>
                                      <p className="text-white">{sub.recurring_day} at {sub.recurring_time}</p>
                                    </div>
                                    <div>
                                      <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Next Visit</p>
                                      <p className="text-[hsl(var(--accent))]">
                                        {sub.next_service_date
                                          ? new Date(sub.next_service_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                          : "TBD"}
                                      </p>
                                    </div>
                                    {sub.service_address && (
                                      <div className="col-span-2">
                                        <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Address</p>
                                        <p className="text-white">{sub.service_address}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-[hsl(var(--muted-foreground))] text-xs uppercase tracking-wider">Location</p>
                                      <p className="text-white">{sub.location === "mobile" ? "Mobile" : "In-Shop"}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* ============ SUBSCRIPTIONS TAB ============ */}
          <TabsContent value="subscriptions">
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  Active Subscriptions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {subscriptions.filter((s) => s.status === "active").length === 0 ? (
                  <p className="py-4 text-[hsl(var(--muted-foreground))]">No active subscriptions.</p>
                ) : (
                  <div className="space-y-4">
                    {subscriptions
                      .filter((s) => s.status === "active")
                      .map((sub) => {
                        const name = sub.profiles
                          ? `${sub.profiles.first_name} ${sub.profiles.last_name}`
                          : "Unknown";
                        const planLabel = SUBSCRIPTION_PLANS.find((p) => p.id === sub.plan)?.name ?? sub.plan;

                        return (
                          <div key={sub.id} className="rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                  <span className="font-[family-name:var(--font-barlow-condensed)] text-lg font-semibold text-white">{name}</span>
                                  <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                  <span>{planLabel}</span>
                                  <span>{PACKAGE_LABELS[sub.package]}</span>
                                  <span>{SERVICE_TYPE_LABELS[sub.service_type]}</span>
                                  <span className="flex items-center gap-1">
                                    <Car className="h-3.5 w-3.5" />
                                    {VEHICLE_LABELS[sub.vehicle_size]}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {sub.recurring_day} at {sub.recurring_time}
                                  </span>
                                  {sub.service_address && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3.5 w-3.5" />
                                      {sub.service_address}
                                    </span>
                                  )}
                                  {sub.profiles?.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3.5 w-3.5" />
                                      {sub.profiles.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-[family-name:var(--font-barlow-condensed)] text-xl font-bold text-[hsl(var(--accent))]">
                                  ${getPrice(sub.package, sub.vehicle_size, sub.service_type)}<span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">/visit</span>
                                </p>
                                {sub.next_service_date && (
                                  <p className="text-sm text-[hsl(var(--accent))] mt-1">
                                    Next: {new Date(sub.next_service_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ TEAM TAB (owner only) ============ */}
          {isOwner && (
            <TabsContent value="team" className="space-y-6">
              <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                    Add Admin
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const emailInput = form.elements.namedItem("admin_email") as HTMLInputElement;
                      const email = emailInput.value.trim();
                      if (!email) return;
                      const { updateUserRole } = await import("./actions");
                      const result = await updateUserRole(email, "admin");
                      if (result.error) {
                        alert(result.error);
                      } else {
                        emailInput.value = "";
                        fetchProfiles();
                      }
                    }}
                    className="flex items-end gap-3"
                  >
                    <div className="flex-1 space-y-2">
                      <Label className="text-white">Email Address</Label>
                      <Input
                        name="admin_email"
                        type="email"
                        placeholder="user@example.com"
                        className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white"
                      />
                    </div>
                    <Button type="submit" className="bg-[hsl(var(--primary))] font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-white hover:bg-[hsl(var(--primary))]/80">
                      <Shield className="mr-2 h-4 w-4" />
                      Make Admin
                    </Button>
                  </form>
                  <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">
                    The user must have an existing account. Enter their signup email to grant admin access.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                    Team Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {teamMembers.length === 0 ? (
                    <p className="py-4 text-[hsl(var(--muted-foreground))]">No team members found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[hsl(var(--muted))]">
                            <TableHead className="text-[hsl(var(--muted-foreground))]">Name</TableHead>
                            <TableHead className="text-[hsl(var(--muted-foreground))]">Role</TableHead>
                            <TableHead className="text-[hsl(var(--muted-foreground))] text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {teamMembers.map((member) => (
                            <TableRow key={member.id} className="border-[hsl(var(--muted))]">
                              <TableCell className="font-medium text-white">{member.first_name} {member.last_name}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={member.role === "owner" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-blue-500/20 text-blue-400 border-blue-500/30"}
                                >
                                  <span className="flex items-center gap-1.5">
                                    {member.role === "owner" ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                                  </span>
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {member.role === "admin" && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={async () => {
                                      if (!confirm(`Remove admin access from ${member.first_name} ${member.last_name}?`)) return;
                                      const { revokeAdmin } = await import("./actions");
                                      const result = await revokeAdmin(member.id);
                                      if (result.error) alert(result.error);
                                      else fetchProfiles();
                                    }}
                                    className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider"
                                  >
                                    Revoke Admin
                                  </Button>
                                )}
                                {member.role === "owner" && (
                                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Owner</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
