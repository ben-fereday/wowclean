import type { Metadata } from "next";
import ManageBooking from "./manage-booking";

export const metadata: Metadata = {
  title: "Manage Your Booking | WOW CLEAN",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ManageBookingPage({ searchParams }: {
  searchParams: Promise<{ demo?: string | string[] }>;
}) {
  const demo = process.env.VERCEL_ENV === "preview" && (await searchParams).demo === "1";
  return <ManageBooking demo={demo} />;
}
