"use client";

import Script from "next/script";

export default function GalleryPage() {
  return (
    <main className="min-h-screen pt-[72px]">
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

      <section className="bg-navy py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <Script
            src="https://cdn.jsdelivr.net/npm/@mirrorapp/iframe-bridge@latest/dist/index.umd.js"
            strategy="lazyOnload"
          />
          <iframe
            onLoad={(e) => {
              const w = window as unknown as { iFrameSetup?: (el: HTMLIFrameElement) => void };
              if (w.iFrameSetup) w.iFrameSetup(e.currentTarget);
            }}
            src="https://app.mirror-app.com/feed-instagram/696853a7-f99d-42d5-8a46-d9aba3a704ba/preview"
            style={{ width: "100%", border: "none", overflow: "hidden", minHeight: "600px" }}
            scrolling="no"
          />
        </div>
      </section>
    </main>
  );
}
