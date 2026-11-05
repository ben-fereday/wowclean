import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Toaster } from "@/components/ui/sonner";

const barlow = Barlow({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400",
});

const title = "WOW CLEAN | Mobile Auto Detailing in Calgary";
const description = "Mobile auto detailing in Calgary. Compare Standard and Premium packages, see pricing, and book your detail online.";

export const metadata: Metadata = {
  metadataBase: new URL("https://wowcleancalgary.com"),
  verification: { google: "gk-8RUyVEBuFh0E-Fv0LBop-lfLUOMlKplibK8B74IQ" },
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "WOW CLEAN Calgary",
    locale: "en_CA",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [{ url: "/opengraph-image", alt: "WOW CLEAN — Mobile auto detailing in Calgary" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
