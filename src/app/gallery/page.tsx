"use client";

import Script from "next/script";

export default function GalleryPage() {
  return (
    <main className="min-h-screen pt-[72px]">
      {/* Hero */}
      <section className="bg-dark py-20 px-6 text-center">
        <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-cyan mb-4">
          Our Work
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-7xl tracking-wider text-white mb-4">
          Gallery
        </h1>
        <p className="text-mid max-w-lg mx-auto leading-relaxed">
          See the results for yourself. Real cars, real transformations, real WOW.
        </p>
      </section>

      {/* Instagram Feed */}
      <section className="bg-navy py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Script src="https://static.elfsight.com/platform/platform.js" strategy="lazyOnload" />
          <div className="elfsight-app-8a586c0e-3ae4-48b3-95af-768947282317" data-elfsight-app-lazy />
        </div>
      </section>
    </main>
  );
}
