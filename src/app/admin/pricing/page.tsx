"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  DollarSign,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  fetchBookingPrices,
  fetchAddonItems,
  fetchSubscriptionPrices,
  updateBookingPrice,
  updateAddonItem,
  addAddonItem,
  deleteAddonItem,
  updateSubscriptionPrice,
  type BookingPricingGrid,
  type AddonItem,
  type SubPricingGrid,
} from "@/lib/pricing-db";
import {
  PACKAGE_LABELS,
  type PackageId,
  type VehicleSize,
  type ServiceType,
  type SubscriptionPlan,
} from "@/lib/constants";

const SIZES: VehicleSize[] = ["small", "medium", "large"];
const SIZE_LABELS: Record<VehicleSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};
const SERVICE_TYPES: ServiceType[] = ["interior", "exterior", "full"];
const SERVICE_LABELS: Record<ServiceType, string> = {
  interior: "Interior",
  exterior: "Exterior",
  full: "Full Detail",
};
const PACKAGES: PackageId[] = ["standard", "premium", "exclusive"];
const SUB_PLANS: { id: SubscriptionPlan; label: string }[] = [
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Bi-Weekly" },
  { id: "monthly", label: "Monthly" },
];
const SUB_PACKAGES: { plan: SubscriptionPlan; pkg: string }[] = [
  { plan: "weekly", pkg: "standard" },
  { plan: "biweekly", pkg: "standard" },
  { plan: "monthly", pkg: "standard" },
  { plan: "monthly", pkg: "premium" },
];

type PendingChange = {
  key: string;
  label: string;
  value: number;
  apply: () => Promise<{ error?: string }>;
};

export default function PricingPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [bookingPrices, setBookingPrices] = useState<BookingPricingGrid>({});
  const [addons, setAddons] = useState<AddonItem[]>([]);
  const [subPrices, setSubPrices] = useState<SubPricingGrid>({});

  // Pending changes awaiting confirmation
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

  // Confirm modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; name: string; id: string }>({ open: false, name: "", id: "" });

  // New addon form
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState(0);

  // Auth check
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile && ["admin", "owner"].includes(profile.role)) {
        setAuthorized(true);
      }
    })();
  }, [supabase]);

  const reload = useCallback(async () => {
    const [b, a, s] = await Promise.all([
      fetchBookingPrices(),
      fetchAddonItems(),
      fetchSubscriptionPrices(),
    ]);
    setBookingPrices(b);
    setAddons(a);
    setSubPrices(s);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { reload(); }, [reload]);

  // Track a pending price change
  function queueChange(
    key: string,
    label: string,
    value: number,
    apply: () => Promise<{ error?: string }>
  ) {
    setPendingChanges((prev) => {
      const filtered = prev.filter((c) => c.key !== key);
      return [...filtered, { key, label, value, apply }];
    });
  }

  async function applyAllChanges() {
    setSaving(true);
    setSaveResult(null);
    const errors: string[] = [];
    for (const change of pendingChanges) {
      const result = await change.apply();
      if (result.error) errors.push(`${change.label}: ${result.error}`);
    }
    setSaving(false);
    if (errors.length > 0) {
      setSaveResult(`Errors: ${errors.join("; ")}`);
    } else {
      setSaveResult(`${pendingChanges.length} price(s) updated.`);
      setPendingChanges([]);
      setConfirmOpen(false);
      reload();
    }
  }

  if (!authorized && !loading) {
    return (
      <main className="min-h-screen bg-[hsl(var(--background))] flex items-center justify-center">
        <p className="text-[hsl(var(--muted-foreground))]">Unauthorized</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[hsl(var(--background))] px-4 pt-[100px] pb-12">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Link>
            <h1 className="font-[family-name:var(--font-heading)] text-4xl uppercase tracking-wide text-white flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-[hsl(var(--accent))]" />
              Pricing Manager
            </h1>
          </div>
          {pendingChanges.length > 0 && (
            <Button
              onClick={() => setConfirmOpen(true)}
              className="bg-yellow-500 hover:bg-yellow-400 text-dark font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider font-bold px-6"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Save {pendingChanges.length} Change
              {pendingChanges.length > 1 ? "s" : ""}
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-[hsl(var(--muted-foreground))]">Loading...</p>
        ) : (
          <>
            {/* ═══ BOOKING PRICES ═══ */}
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  One-Time Booking Prices
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {PACKAGES.map((pkg) => (
                  <div key={pkg}>
                    <h3 className="font-[family-name:var(--font-heading)] text-lg tracking-wider text-[hsl(var(--accent))] mb-3">
                      {PACKAGE_LABELS[pkg]}
                    </h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[hsl(var(--muted))]">
                            <TableHead className="text-[hsl(var(--muted-foreground))]">
                              Service
                            </TableHead>
                            {SIZES.map((s) => (
                              <TableHead
                                key={s}
                                className="text-[hsl(var(--muted-foreground))] text-center"
                              >
                                {SIZE_LABELS[s]}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {SERVICE_TYPES.map((st) => (
                            <TableRow
                              key={st}
                              className="border-[hsl(var(--muted))]"
                            >
                              <TableCell className="text-white font-medium">
                                {SERVICE_LABELS[st]}
                              </TableCell>
                              {SIZES.map((sz) => {
                                const val =
                                  bookingPrices?.[pkg]?.[sz]?.[st] ?? 0;
                                const changeKey = `booking-${pkg}-${sz}-${st}`;
                                const hasPending = pendingChanges.some(
                                  (c) => c.key === changeKey
                                );
                                return (
                                  <TableCell key={sz} className="text-center">
                                    <div className="relative inline-flex items-center">
                                      <span className="text-[hsl(var(--muted-foreground))] absolute left-2 text-sm">
                                        $
                                      </span>
                                      <input
                                        type="number"
                                        min={0}
                                        defaultValue={val}
                                        onBlur={(e) => {
                                          const newVal = Number(e.target.value);
                                          if (newVal === val) {
                                            setPendingChanges((p) =>
                                              p.filter(
                                                (c) => c.key !== changeKey
                                              )
                                            );
                                            return;
                                          }
                                          queueChange(
                                            changeKey,
                                            `${PACKAGE_LABELS[pkg]} ${SERVICE_LABELS[st]} ${SIZE_LABELS[sz]}`,
                                            newVal,
                                            () =>
                                              updateBookingPrice(
                                                pkg,
                                                sz,
                                                st,
                                                newVal
                                              )
                                          );
                                        }}
                                        className={`w-24 h-8 rounded-md border text-white text-sm text-center pl-6 bg-[hsl(var(--background))] ${
                                          hasPending
                                            ? "border-yellow-500/60"
                                            : "border-[hsl(var(--muted-foreground))]/30"
                                        }`}
                                      />
                                      {hasPending && (
                                        <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-yellow-500" />
                                      )}
                                    </div>
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ═══ ADD-ONS ═══ */}
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  Add-Ons
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[hsl(var(--muted))]">
                        <TableHead className="text-[hsl(var(--muted-foreground))]">
                          Name
                        </TableHead>
                        <TableHead className="text-[hsl(var(--muted-foreground))]">
                          Starting Price
                        </TableHead>
                        <TableHead className="text-[hsl(var(--muted-foreground))]">
                          Status
                        </TableHead>
                        <TableHead className="text-[hsl(var(--muted-foreground))] text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {addons.map((addon) => (
                        <TableRow
                          key={addon.id}
                          className="border-[hsl(var(--muted))]"
                        >
                          <TableCell className="text-white font-medium">
                            {addon.name}
                          </TableCell>
                          <TableCell>
                            <div className="relative inline-flex items-center">
                              <span className="text-[hsl(var(--muted-foreground))] absolute left-2 text-sm">
                                $
                              </span>
                              <input
                                type="number"
                                min={0}
                                defaultValue={addon.price}
                                onBlur={(e) => {
                                  const newVal = Number(e.target.value);
                                  if (newVal === addon.price) return;
                                  const key = `addon-price-${addon.id}`;
                                  queueChange(
                                    key,
                                    `${addon.name} price`,
                                    newVal,
                                    () =>
                                      updateAddonItem(addon.id, {
                                        price: newVal,
                                      })
                                  );
                                }}
                                className={`w-24 h-8 rounded-md border text-white text-sm text-center pl-6 bg-[hsl(var(--background))] ${
                                  pendingChanges.some(
                                    (c) => c.key === `addon-price-${addon.id}`
                                  )
                                    ? "border-yellow-500/60"
                                    : "border-[hsl(var(--muted-foreground))]/30"
                                }`}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                addon.active
                                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                                  : "bg-red-500/20 text-red-400 border-red-500/30"
                              }
                            >
                              {addon.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await updateAddonItem(addon.id, {
                                  active: !addon.active,
                                });
                                reload();
                              }}
                              className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-xs"
                            >
                              {addon.active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setDeleteConfirm({ open: true, name: addon.name, id: addon.id });
                              }}
                              className="font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Add new addon */}
                <div className="mt-6 flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label className="text-white text-xs uppercase tracking-wider">
                      New Add-On Name
                    </Label>
                    <Input
                      value={newAddonName}
                      onChange={(e) => setNewAddonName(e.target.value)}
                      placeholder="e.g. Headlight Restoration"
                      className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white"
                    />
                  </div>
                  <div className="w-32 space-y-2">
                    <Label className="text-white text-xs uppercase tracking-wider">
                      Price
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={newAddonPrice}
                      onChange={(e) => setNewAddonPrice(Number(e.target.value))}
                      className="border-[hsl(var(--muted-foreground))]/30 bg-[hsl(var(--background))] text-white"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (!newAddonName.trim()) return;
                      const id = newAddonName
                        .toLowerCase()
                        .replace(/\s+/g, "_")
                        .replace(/[^a-z0-9_]/g, "");
                      const result = await addAddonItem({
                        id,
                        name: newAddonName.trim(),
                        price: newAddonPrice,
                      });
                      if (result.error) {
                        toast.error(result.error);
                      } else {
                        toast.success("Add-on created.");
                        setNewAddonName("");
                        setNewAddonPrice(0);
                        reload();
                      }
                    }}
                    className="bg-[hsl(var(--primary))] font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider text-white hover:bg-[hsl(var(--primary))]/80"
                  >
                    <Plus className="mr-1 h-4 w-4" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ═══ SUBSCRIPTION PRICES ═══ */}
            <Card className="border-[hsl(var(--muted))] bg-[hsl(var(--card))]">
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white">
                  Subscription Prices (Per Visit)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[hsl(var(--muted))]">
                        <TableHead className="text-[hsl(var(--muted-foreground))]">
                          Plan
                        </TableHead>
                        <TableHead className="text-[hsl(var(--muted-foreground))]">
                          Package
                        </TableHead>
                        {SIZES.map((s) => (
                          <TableHead
                            key={s}
                            className="text-[hsl(var(--muted-foreground))] text-center"
                          >
                            {SIZE_LABELS[s]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {SUB_PACKAGES.map(({ plan, pkg }) => {
                        const planLabel =
                          SUB_PLANS.find((p) => p.id === plan)?.label ?? plan;
                        const pkgLabel =
                          pkg === "standard"
                            ? "The Standard"
                            : "Premium Detail";
                        return (
                          <TableRow
                            key={`${plan}-${pkg}`}
                            className="border-[hsl(var(--muted))]"
                          >
                            <TableCell className="text-white font-medium">
                              {planLabel}
                            </TableCell>
                            <TableCell className="text-[hsl(var(--muted-foreground))]">
                              {pkgLabel}
                            </TableCell>
                            {SIZES.map((sz) => {
                              const val =
                                subPrices?.[plan]?.[pkg]?.[sz] ?? 0;
                              const changeKey = `sub-${plan}-${pkg}-${sz}`;
                              const hasPending = pendingChanges.some(
                                (c) => c.key === changeKey
                              );
                              return (
                                <TableCell key={sz} className="text-center">
                                  <div className="relative inline-flex items-center">
                                    <span className="text-[hsl(var(--muted-foreground))] absolute left-2 text-sm">
                                      $
                                    </span>
                                    <input
                                      type="number"
                                      min={0}
                                      defaultValue={val}
                                      onBlur={(e) => {
                                        const newVal = Number(e.target.value);
                                        if (newVal === val) {
                                          setPendingChanges((p) =>
                                            p.filter(
                                              (c) => c.key !== changeKey
                                            )
                                          );
                                          return;
                                        }
                                        queueChange(
                                          changeKey,
                                          `${planLabel} ${pkgLabel} ${SIZE_LABELS[sz]}`,
                                          newVal,
                                          () =>
                                            updateSubscriptionPrice(
                                              plan,
                                              pkg,
                                              sz,
                                              newVal
                                            )
                                        );
                                      }}
                                      className={`w-24 h-8 rounded-md border text-white text-sm text-center pl-6 bg-[hsl(var(--background))] ${
                                        hasPending
                                          ? "border-yellow-500/60"
                                          : "border-[hsl(var(--muted-foreground))]/30"
                                      }`}
                                    />
                                    {hasPending && (
                                      <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-yellow-500" />
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ CONFIRMATION DIALOG ═══ */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="border-[hsl(var(--accent))]/20 bg-[#0b1740] shadow-xl max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-heading)] text-2xl uppercase tracking-wide text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Confirm Price Changes
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
              {pendingChanges.map((change) => (
                <div
                  key={change.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--muted))] bg-[hsl(var(--background))] p-3"
                >
                  <span className="text-sm text-white">{change.label}</span>
                  <span className="font-mono font-bold text-[hsl(var(--accent))]">
                    ${change.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button
                onClick={applyAllChanges}
                disabled={saving}
                className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-dark font-[family-name:var(--font-barlow-condensed)] uppercase tracking-wider font-bold"
              >
                {saving ? (
                  "Saving..."
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Confirm Changes
                  </>
                )}
              </Button>
            </div>
            {saveResult && (
              <p
                className={`text-sm mt-2 ${
                  saveResult.startsWith("Error")
                    ? "text-red-400"
                    : "text-green-400"
                }`}
              >
                {saveResult}
              </p>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmModal
          open={deleteConfirm.open}
          onOpenChange={(open) => setDeleteConfirm((d) => ({ ...d, open }))}
          title="Delete Add-On"
          description={`Delete "${deleteConfirm.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={async () => {
            await deleteAddonItem(deleteConfirm.id);
            setDeleteConfirm({ open: false, name: "", id: "" });
            toast.success("Add-on deleted.");
            reload();
          }}
        />
      </div>
    </main>
  );
}
