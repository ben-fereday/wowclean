import Link from "next/link";
import { EXTERIOR_BOOKINGS_ENABLED, SEASONAL_EXTERIOR_MESSAGE, INTERIOR_REQUIREMENTS, isAddonBookable } from "@/lib/service-availability";
import { fetchAllPricing, type BookingPricingGrid, type AddonItem } from "@/lib/pricing-db";
import {
  CalendarCheck,
  Truck,
  Sparkles,
  Zap,
  Phone,
  ArrowRight,
  Check,
} from "lucide-react";
/* ───────────────────────── HERO ───────────────────────── */
function Hero() {
  return (
    <section className="bg-dark grid grid-cols-1 gap-10 lg:grid-cols-2 items-center px-6 md:px-[60px] pt-[140px] pb-20 lg:py-36 relative overflow-hidden">
      {/* Glow effects */}
      <div className="absolute -top-[150px] -right-[150px] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(26,74,255,0.22)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute -bottom-[100px] left-[20%] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(91,243,255,0.1)_0%,transparent_70%)] pointer-events-none" />
      {/* Bottom stripe */}
      <div className="absolute bottom-0 left-0 right-0 h-2 bg-[repeating-linear-gradient(90deg,#fff_0px,#fff_16px,#111_16px,#111_32px)] opacity-50" />

      {/* Left */}
      <div className="relative z-10 text-center lg:text-left">
        <h1 className="font-[family-name:var(--font-heading)] text-[clamp(3rem,5.5vw,5.5rem)] leading-[0.95] tracking-wide text-white mb-2.5">
          Mobile Auto Detailing in Calgary
          <span className="block text-[clamp(4.5rem,8.5vw,8.5rem)] leading-[0.9] bg-gradient-to-br from-white via-cyan to-blue bg-clip-text text-transparent">
            WOW CLEAN
          </span>
        </h1>
        <p className="font-[family-name:var(--font-barlow-condensed)] text-[1.15rem] font-semibold tracking-[4px] uppercase text-silver mb-7">
          We Come to You — You Stay Amazed
        </p>
        <p className="text-[1.05rem] text-mid leading-[1.75] max-w-[460px] mb-11 mx-auto lg:mx-0">
          Mobile auto detailing in Calgary, at a suitable location where
          detailing is permitted.
        </p>
        <div className="flex gap-4 flex-wrap justify-center lg:justify-start">
          <Link
            href="/contact"
            className="inline-flex items-center gap-2.5 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-bold tracking-wide uppercase px-10 py-[17px] rounded shadow-[0_0_40px_rgba(26,74,255,0.45)] hover:translate-y-[-3px] hover:shadow-[0_0_60px_rgba(26,74,255,0.7)] transition-all"
          >
            <Phone className="size-5" />
            Call WOW CLEAN
          </Link>
          <Link
            href="#services"
            className="inline-flex items-center gap-2.5 border-[1.5px] border-white/[0.18] text-white font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-semibold tracking-wide uppercase px-9 py-[17px] rounded hover:border-cyan hover:text-cyan transition-all"
          >
            See Packages
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* Right - Phone card */}
      <div className="flex justify-center items-center relative z-10">
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-[20px] p-[52px_56px] max-md:p-[36px_24px] text-center relative overflow-hidden backdrop-blur-[12px] shadow-[0_30px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]">
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan to-transparent" />
          {/* Corner pattern */}
          <div className="absolute bottom-0 right-0 w-20 h-20 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_8px,transparent_8px,transparent_16px)] rounded-br-[20px]" />

          <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] tracking-[3px] uppercase text-mid mb-3">
            Book Your Detail Today
          </p>
          <div className="font-[family-name:var(--font-heading)] text-[clamp(1.8rem,3vw,3rem)] text-white tracking-[3px] mb-1.5 leading-none">
            <span className="text-cyan">WOW</span> CLEAN
          </div>
          <Link
            href="/book"
            className="flex items-center justify-center gap-2.5 w-full bg-gradient-to-br from-cyan to-blue text-navy font-[family-name:var(--font-barlow-condensed)] text-[1.1rem] font-extrabold tracking-[2px] uppercase py-4 rounded-lg hover:scale-[1.03] hover:opacity-90 transition-all shadow-[0_0_30px_rgba(91,243,255,0.35)]"
          >
            <Zap className="size-5" />
            Book Now
          </Link>

        </div>
      </div>
    </section>
  );
}

/* ───────────────────── HOW IT WORKS ───────────────────── */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: <CalendarCheck className="size-7 text-white" />,
      title: "Book Online",
      desc: "Book in minutes online. Tell us your vehicle type and location — we handle the rest.",
    },
    {
      num: "02",
      icon: <Truck className="size-7 text-white" />,
      title: "We Come to You",
      desc: "Mobile detailing at your home, by appointment.",
    },
    {
      num: "03",
      icon: <Sparkles className="size-7 text-white" />,
      title: "Drive Away Amazed",
      desc: "Review your vehicle after the detail is complete.",
    },
  ];

  return (
    <section id="how" className="bg-[#f4f6fb] py-[100px] px-6 md:px-[60px] text-center relative overflow-hidden">
      {/* Top stripe */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(90deg,#0b1740_0px,#0b1740_16px,#1a4aff_16px,#1a4aff_32px)]" />
      <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.8rem] font-bold tracking-[3.5px] uppercase text-blue mb-4">
        Simple as 1 – 2 – 3
      </p>
      <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.4rem,5vw,4rem)] tracking-wide text-navy mb-[60px]">
        How It <span className="text-blue">Works</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-[1000px] mx-auto">
        {steps.map((step, i) => (
          <div key={i} className="relative px-9 py-12 text-center">
            {/* Big background number */}
            <div className="font-[family-name:var(--font-heading)] text-[5rem] leading-none text-blue/10 absolute top-4 left-1/2 -translate-x-1/2 z-0">
              {step.num}
            </div>
            {/* Icon */}
            <div className="w-[72px] h-[72px] bg-gradient-to-br from-blue2 to-blue rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_8px_30px_rgba(26,74,255,0.35)] relative z-10">
              {step.icon}
            </div>
            <h3 className="font-[family-name:var(--font-barlow-condensed)] text-[1.4rem] font-bold tracking-wide uppercase text-navy mb-3 relative z-10">
              {step.title}
            </h3>
            <p className="text-[0.95rem] text-[#557] leading-[1.7] relative z-10">
              {step.desc}
            </p>
            {/* Arrow between steps (hidden on mobile, hidden on last) */}
            {i < steps.length - 1 && (
              <div className="hidden md:flex absolute -right-[22px] top-1/2 -translate-y-1/2 text-blue opacity-40">
                <ArrowRight className="size-6" />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────── PRICING TABLE ─────────────────── */
function PriceTable({
  rows,
}: {
  rows: { service: string; small: string; medium: string; large: string }[];
}) {
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-[14px] overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Service", "Small", "Medium", "Large"].map((h, i) => (
              <th
                key={h}
                className={`bg-white/[0.06] font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-wide uppercase text-white px-1.5 py-3 sm:px-3 ${i === 0 ? "text-left" : "text-center"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isLast = i === rows.length - 1;
            return (
              <tr key={i}>
                <td
                  className={`px-1.5 py-3 sm:px-3 border-t border-white/[0.06] text-sm ${isLast ? "bg-blue/[0.08] font-semibold text-white" : "text-white"}`}
                >
                  {row.service}
                  {!EXTERIOR_BOOKINGS_ENABLED && row.service !== "Interior Only" && (
                    <span className="block text-xs font-normal text-yellow mt-1">SPRING / SUMMER ONLY</span>
                  )}
                </td>
                {[row.small, row.medium, row.large].map((val, j) => (
                  <td
                    key={j}
                    className={`px-1.5 py-3 sm:px-3 border-t border-white/[0.06] text-center font-[family-name:var(--font-heading)] text-[1.15rem] tracking-wide ${isLast ? "bg-blue/[0.08] text-cyan" : "text-cyan"}`}
                  >
                    {val}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────── SERVICES ───────────────────── */
function fmt(n: number) {
  return `$${n}`;
}

function Services({
  bp,
  addons,
}: {
  bp: BookingPricingGrid;
  addons: AddonItem[];
}) {
  return (
    <section id="services" className="scroll-mt-24 bg-navy py-[100px] px-6 md:px-[60px]">
      <div className="max-w-[900px] mx-auto mb-10 rounded-xl border border-cyan/20 bg-cyan/[0.05] p-5 text-sm leading-relaxed">
        <p className="text-white font-semibold mb-2">Interior detailing available to book</p>
        <p className="text-mid">{INTERIOR_REQUIREMENTS}</p>
        {!EXTERIOR_BOOKINGS_ENABLED && <p className="text-mid mt-2">{SEASONAL_EXTERIOR_MESSAGE}</p>}
      </div>

      {/* Vehicle Size Guide */}
      <div className="max-w-[700px] mx-auto mb-16 text-center">
        <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[3px] uppercase text-blue mb-4">
          Vehicle Size Guide
        </p>
        <div className="flex justify-center flex-wrap gap-3">
          {[
            { size: "Small", types: "Coupe · Sedan · Hatchback" },
            { size: "Medium", types: "Crossover · Small SUV · Wagon" },
            { size: "Large", types: "Full-Size SUV · Truck · Minivan" },
          ].map((chip) => (
            <div
              key={chip.size}
              className="bg-white/[0.06] border border-white/[0.12] rounded-lg px-5 py-2.5 font-[family-name:var(--font-barlow-condensed)] text-[0.85rem] font-semibold tracking-[1.5px] uppercase text-silver"
            >
              <strong className="block text-cyan text-[0.72rem] tracking-[2px] mb-0.5">
                {chip.size}
              </strong>
              {chip.types}
            </div>
          ))}
        </div>
      </div>

      <p className="font-[family-name:var(--font-barlow-condensed)] text-[0.8rem] font-bold tracking-[3.5px] uppercase text-cyan mb-4 text-center">
        Automotive Detailing Packages
      </p>
      <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.4rem,5vw,4rem)] tracking-wide text-white mb-5 text-center">
        Choose Your <span className="text-cyan">Clean.</span>
      </h2>
      <p className="text-center text-mid text-base max-w-[660px] mx-auto mb-12 leading-[1.8]">
        Choose interior, exterior, or full detailing. Pricing varies by vehicle
        size and condition.
      </p>

      <div className="mx-auto mb-16 grid max-w-[1200px] gap-x-6 gap-y-5 lg:grid-cols-2">
        {([
          {
            id: "standard",
            name: "The Standard",
            tagline: "Everyday upkeep",
            description: "A maintenance detail for vehicles that need a proper refresh.",
            interior: ["Full interior vacuum", "Cleaning of dash, console, door panels and accessible surfaces", "Interior glass cleaned", "Light dust & debris removal"],
            exterior: ["Hand wash and dry", "Wheels cleaned", "Tire dressing", "Exterior glass cleaned", "Paint sealant applied for added shine & short-term protection"],
          },
          {
            id: "premium",
            name: "Premium Detail",
            tagline: "A deeper refresh",
            description: "Everything in The Standard, plus extra attention inside and out.",
            interior: ["Thorough interior surface cleaning, including crevices, cupholders and vents", "Leather cleaning & conditioning where applicable"],
            exterior: ["Chemical & physical decontamination treatment", "Engine bay clean and dressing", "Enhanced finish and protection"],
          },
        ] as const).map(pkg => (
          <article key={pkg.id} className="grid min-w-0 gap-5 rounded-2xl border border-white/15 bg-dark/75 p-5 sm:p-7 lg:row-span-5 lg:grid-rows-subgrid">
            <header>
              <p className="text-xs uppercase tracking-widest text-cyan">{pkg.tagline}</p>
              <h3 className="mt-2 font-[family-name:var(--font-heading)] text-4xl text-white">{pkg.name}</h3>
              <p className="mt-2 text-mid">{pkg.description}</p>
            </header>
            {(["interior", "exterior"] as const).map(service => (
              <section key={service} className="border-t border-white/10 pt-4">
                <h4 className="mb-3 text-sm font-semibold capitalize tracking-wide text-cyan">
                  {service}{service === "exterior" && !EXTERIOR_BOOKINGS_ENABLED && <span className="ml-2 text-xs text-mid">Spring / summer</span>}
                </h4>
                <ul className="space-y-2 text-sm text-silver">
                  {pkg[service].map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-cyan" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <PriceTable rows={([
              ["Interior Only", "interior"],
              ["Exterior Only", "exterior"],
              ["Full Detail", "full"],
            ] as const).map(([service, key]) => ({
              service,
              small: fmt(bp?.[pkg.id]?.small?.[key] ?? 0),
              medium: fmt(bp?.[pkg.id]?.medium?.[key] ?? 0),
              large: fmt(bp?.[pkg.id]?.large?.[key] ?? 0),
            }))} />
            <Link href="/book"
              className="flex items-center justify-between gap-3 rounded-lg border border-cyan/30 bg-cyan/5 px-4 py-3 font-semibold text-cyan hover:bg-cyan/10 focus-visible:outline-2 focus-visible:outline-cyan">
              Book {pkg.name}
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </article>
        ))}
      </div>

      {/* ── ADD-ONS ── */}
      <div className="max-w-[1200px] mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2rem,4vw,3.2rem)] tracking-wide text-white mb-2">
            Customize Your <span className="text-[#ffe066]">Detail</span>
          </h2>
          <p className="text-mid text-[0.95rem]">
            Add any of the following services to any package based on your
            vehicle&apos;s condition and needs.
          </p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-[14px] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="bg-white/[0.06] font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[2px] uppercase text-mid py-3 px-5 text-left">
                  Add-On Service
                </th>
                <th className="bg-white/[0.06] font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[2px] uppercase text-mid py-3 px-5 text-right">
                  Starting Price
                </th>
              </tr>
            </thead>
            <tbody>
              {addons.filter(a => a.active).map((addon) => ({
                name: isAddonBookable(addon.id) ? addon.name : `${addon.name} — seasonal, currently unavailable`,
                price: `from $${addon.price}`,
              })).map((addon) => (
                <tr key={addon.name} className="hover:bg-white/[0.02]">
                  <td className="py-[11px] px-5 border-t border-white/[0.05] text-sm text-silver">
                    {addon.name}
                  </td>
                  <td className="py-[11px] px-5 border-t border-white/[0.05] text-right whitespace-nowrap">
                    {addon.price ? (
                      <span className="font-[family-name:var(--font-heading)] text-[1.1rem] text-cyan tracking-wide">
                        {addon.price}
                      </span>
                    ) : (
                      <span className="text-[#ffe066] font-[family-name:var(--font-barlow-condensed)] text-sm tracking-wide">
                        Custom Quote
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Important Notes */}
      <div className="max-w-[1200px] mx-auto mt-12 bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 sm:p-7 sm:px-8">
        <div className="font-[family-name:var(--font-barlow-condensed)] text-[0.75rem] font-bold tracking-[3px] uppercase text-mid mb-3.5">
          Important Notes
        </div>
        <ul className="flex flex-col gap-2">
          {[
            {
              text: (
                <>
                  Final pricing depends on{" "}
                  <strong className="text-silver">
                    vehicle size, condition, and time required
                  </strong>
                  .
                </>
              ),
            },
            {
              text: (
                <>
                  Excessively dirty vehicles may be subject to{" "}
                  <strong className="text-silver">additional charges</strong>.
                </>
              ),
            },
            {
              text: (
                <>
                  Mobile service pricing may vary slightly based on{" "}
                  <strong className="text-silver">location</strong>.
                </>
              ),
            },
          ].map((note, i) => (
            <li
              key={i}
              className="text-[0.88rem] text-mid pl-[18px] relative leading-[1.6]"
            >
              <span className="absolute left-0 text-blue">•</span>
              {note.text}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────── CTA STRIP ─────────────────────── */
function CtaStrip() {
  return (
    <section className="bg-gradient-to-br from-blue2 via-blue to-[#0066cc] py-20 px-6 md:px-[60px] text-center relative overflow-hidden">
      {/* Top stripe */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.3)_0px,rgba(255,255,255,0.3)_14px,transparent_14px,transparent_28px)]" />
      {/* Bottom stripe */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.3)_0px,rgba(255,255,255,0.3)_14px,transparent_14px,transparent_28px)]" />

      <h2 className="font-[family-name:var(--font-heading)] text-[clamp(2.5rem,5vw,4.5rem)] tracking-wide text-white mb-3">
        Book Your Detail
      </h2>
      <p className="text-[1.1rem] text-white/80 mb-10 max-w-[500px] mx-auto">
        Contact WOW CLEAN to arrange your next detail.
      </p>
      <Link
        href="/book"
        className="inline-flex items-center gap-2.5 bg-white text-blue font-[family-name:var(--font-barlow-condensed)] text-[1.15rem] font-bold tracking-wide uppercase px-12 py-[18px] rounded shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:translate-y-[-3px] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] transition-all"
      >
        <CalendarCheck className="size-5" />
        Book My Detail Now
      </Link>
    </section>
  );
}

/* ───────────────────────── PAGE ───────────────────────── */
export default async function Home() {
  const pricing = await fetchAllPricing();
  return (
    <>
      <Hero />
      <HowItWorks />
      <Services bp={pricing.booking} addons={pricing.addons} />
      <CtaStrip />
    </>
  );
}
