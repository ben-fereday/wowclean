import type { Metadata } from "next";
import ManageBooking from "./manage-booking";

export const metadata: Metadata = {
  title: "Manage Your Booking | WOW CLEAN",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ManageBookingPage() {
  return <ManageBooking />;
}
