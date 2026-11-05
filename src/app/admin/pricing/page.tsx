import { redirect } from "next/navigation";

export default function PricingPage() {
  redirect("/admin?tab=pricing");
}
