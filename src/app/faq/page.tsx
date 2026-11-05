import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { EXTERIOR_BOOKINGS_ENABLED, INTERIOR_REQUIREMENTS } from "@/lib/service-availability";

export const metadata: Metadata = {
  title: "Calgary Detailing FAQ | WOW CLEAN",
  description: "What to expect from a WOW CLEAN mobile detail in Calgary, from preparing your vehicle to pricing and managing your appointment.",
};

const sections = [
  {
    title: "Before your detail",
    questions: [
      {
        question: "Do you come to me?",
        answer: "Yes. WOW CLEAN is a mobile detailing service in Calgary. Choose a suitable location where detailing is permitted and provide the service address when you book.",
      },
      {
        question: "What do I need to provide?",
        answer: EXTERIOR_BOOKINGS_ENABLED
          ? INTERIOR_REQUIREMENTS + " Exterior and full detailing also require customer-provided water and suitable above-freezing conditions."
          : INTERIOR_REQUIREMENTS,
      },
      {
        question: "Can I book in winter?",
        answer: "Yes. Interior detailing is available in winter if you can provide a suitable heated indoor workspace. Exterior and full detailing are seasonal and depend on the weather. The booking page shows what’s available.",
      },
      {
        question: "How should I prepare my vehicle?",
        answer: "Please remove personal items from the areas you’d like cleaned. When booking, use the notes field to flag pet hair, heavy staining, or any access instructions.",
      },
    ],
  },
  {
    title: "Pricing and payment",
    questions: [
      {
        question: "What could change my estimated price?",
        answer: "Your estimate depends on the vehicle size, package, service, and add-ons you choose. The final price depends on vehicle condition. Excessively dirty vehicles may incur additional charges.",
      },
      {
        question: "When do I pay?",
        answer: "Payment is due when the detail is complete. We accept credit, debit, cash, and e-transfer.",
      },
    ],
  },
  {
    title: "Managing your booking",
    questions: [
      {
        question: "How do I reschedule or cancel?",
        answer: "Open the private Manage booking link in your confirmation email. Eligible appointments can be rescheduled or cancelled online at least 24 hours before the start time. If you’re within 24 hours or the option is unavailable, call (587) 436-9605.",
      },
      {
        question: "Do I need an account to manage my booking?",
        answer: "No. Your private booking link opens your appointment details without signing in. Keep it private, since anyone with the link can manage your appointment.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <main className="min-h-screen bg-dark px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-36">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-cyan">WOW CLEAN Calgary</p>
          <h1 className="font-[family-name:var(--font-heading)] text-5xl text-white sm:text-7xl">Frequently asked questions</h1>
          <p className="mt-4 text-base leading-relaxed text-mid">
            What to know before booking a mobile detail, and how to manage your appointment afterward.
          </p>
        </header>

        <div className="space-y-8">
          {sections.map(({ title, questions }) => (
            <section key={title}>
              <h2 className="mb-3 font-[family-name:var(--font-heading)] text-2xl tracking-wide text-white">{title}</h2>
              <div className="space-y-2">
                {questions.map(({ question, answer }) => (
                  <details key={question} className="group rounded-xl border border-white/10 bg-navy/60 open:border-cyan/30">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-4 font-semibold text-white hover:text-cyan focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan sm:px-5 [&::-webkit-details-marker]:hidden">
                      {question}
                      <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-cyan group-open:rotate-180" />
                    </summary>
                    <p className="px-4 pb-4 leading-relaxed text-mid sm:px-5">{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-cyan/20 bg-navy/60 p-5 sm:p-7">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl text-white">Ready to book?</h2>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/book" className="inline-flex items-center gap-2 rounded-xl bg-cyan px-5 py-3 font-semibold text-navy hover:bg-cyan/85">
              Book your detail <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <a href="tel:+15874369605" className="text-sm font-semibold text-cyan underline">Call WOW CLEAN</a>
          </div>
        </div>
      </div>
    </main>
  );
}
