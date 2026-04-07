import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  PACKAGE_LABELS,
  SERVICE_TYPE_LABELS,
  VEHICLE_LABELS,
} from "@/lib/constants";
import AccountClient from "./account-client";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/account");

  const [{ data: profile }, { data: bookings }, { data: subscriptions }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user.id)
        .order("booking_date", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["active", "paused"])
        .order("created_at", { ascending: false }),
    ]);

  return (
    <AccountClient
      email={user.email ?? ""}
      profile={profile}
      bookings={bookings ?? []}
      subscriptions={subscriptions ?? []}
      packageLabels={PACKAGE_LABELS}
      serviceTypeLabels={SERVICE_TYPE_LABELS}
      vehicleLabels={VEHICLE_LABELS}
    />
  );
}
