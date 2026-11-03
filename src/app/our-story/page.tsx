import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Story Behind WOW CLEAN",
  description: "Meet Ben, the University of Calgary business student behind WOW CLEAN mobile detailing.",
};

export default function StoryPage() {
  return (
    <main className="min-h-screen bg-navy px-6 md:px-[60px] pt-36 pb-24">
      <article className="max-w-[800px] mx-auto">
        <p className="font-[family-name:var(--font-barlow-condensed)] text-sm font-bold tracking-[3px] uppercase text-cyan mb-4">
          A local business. Personal service.
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-[clamp(2.5rem,6vw,4.5rem)] leading-tight tracking-wide text-white mb-10">
          The Story Behind <span className="text-cyan">WOW CLEAN</span>
        </h1>
        <div className="space-y-6 text-base md:text-lg text-silver leading-[1.85]">
          <p>Hi, I’m Ben, a business student at the University of Calgary and the owner of WOW CLEAN. I started detailing for friends and family, and that interest grew into a small local business built around careful work, clear pricing, and personal service.</p>
          <p>Growing up, my family spent weekends driving to the mountains to ski. I saw how quickly a car could get messy with a busy schedule, winter roads, and kids along for the ride.</p>
          <p>For many people, a vehicle is one of their biggest purchases. I started WOW CLEAN to make looking after it more convenient, whether it needs regular upkeep or a thorough interior clean.</p>
          <p>I handle each detail myself, so you’ll deal directly with the person doing the work—from arranging your appointment to handing back your keys. My goal is to earn your trust and build a business you feel comfortable recommending to friends and neighbours.</p>
          <p className="border-l-2 border-yellow pl-5">During Calgary’s cold winter months, I offer interior detailing only. Exterior services will be available in spring and summer, weather permitting.</p>
        </div>
        <Link href="/book" className="inline-flex mt-10 bg-cyan text-navy font-[family-name:var(--font-barlow-condensed)] font-bold uppercase tracking-wide px-7 py-3.5 rounded-lg hover:bg-cyan/85 transition-colors">
          Book Your Detail
        </Link>
      </article>
    </main>
  );
}
