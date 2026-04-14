import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  ExternalLink,
} from "lucide-react";

const serviceLinks = [
  { label: "Exterior Wash", href: "/#services" },
  { label: "Interior Detail", href: "/#services" },
  { label: "Full Detail", href: "/#services" },
  { label: "Paint Correction", href: "/#services" },
  { label: "Subscriptions", href: "/subscriptions" },
];

const companyLinks = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Why Us", href: "/#why-us" },
  { label: "Gallery", href: "/gallery" },
  { label: "Book Now", href: "/book" },
];

const socialLinks = [
  { label: "Facebook", href: "#" },
  { label: "Instagram", href: "#" },
  { label: "TikTok", href: "#" },
];

export function Footer() {
  return (
    <footer className="bg-dark border-t border-navy2">
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-baseline gap-1.5 mb-4">
              <span className="font-[family-name:var(--font-heading)] text-3xl leading-none tracking-wide text-cyan">
                WOW
              </span>
              <span className="font-[family-name:var(--font-heading)] text-3xl leading-none tracking-wide text-white">
                CLEAN
              </span>
            </Link>
            <p className="text-mid text-sm leading-relaxed max-w-xs">
              Premium mobile auto detailing delivered to your driveway, office,
              or anywhere you choose. Calgary&apos;s #1 rated mobile detailing
              service.
            </p>
          </div>

          {/* Services column */}
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-lg tracking-wider text-white mb-4">
              Services
            </h3>
            <ul className="flex flex-col gap-2.5">
              {serviceLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-[family-name:var(--font-barlow-condensed)] text-sm text-mid hover:text-cyan transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-lg tracking-wider text-white mb-4">
              Company
            </h3>
            <ul className="flex flex-col gap-2.5">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-[family-name:var(--font-barlow-condensed)] text-sm text-mid hover:text-cyan transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact column */}
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-lg tracking-wider text-white mb-4">
              Contact
            </h3>
            <ul className="flex flex-col gap-3">
              <li>
                <a
                  href="tel:+15878913265"
                  className="flex items-center gap-2.5 text-sm text-mid hover:text-cyan transition-colors group"
                >
                  <Phone className="size-4 text-cyan/60 group-hover:text-cyan transition-colors" />
                  <span className="font-[family-name:var(--font-barlow-condensed)]">
                    (587) 891-3265
                  </span>
                </a>
              </li>
              <li>
                <a
                  href="mailto:teamwowclean@gmail.com"
                  className="flex items-center gap-2.5 text-sm text-mid hover:text-cyan transition-colors group"
                >
                  <Mail className="size-4 text-cyan/60 group-hover:text-cyan transition-colors" />
                  <span className="font-[family-name:var(--font-barlow-condensed)]">
                    teamwowclean@gmail.com
                  </span>
                </a>
              </li>
              <li>
                <div className="flex items-start gap-2.5 text-sm text-mid">
                  <MapPin className="size-4 text-cyan/60 mt-0.5 shrink-0" />
                  <span className="font-[family-name:var(--font-barlow-condensed)]">
                    Mobile Service
                    <br />
                    Calgary, AB
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-navy2">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
            <p className="text-xs text-mid/60 font-[family-name:var(--font-barlow-condensed)]">
              &copy; {new Date().getFullYear()} WowClean. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href="/terms"
                className="text-xs text-mid/60 hover:text-cyan transition-colors font-[family-name:var(--font-barlow-condensed)]"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="text-xs text-mid/60 hover:text-cyan transition-colors font-[family-name:var(--font-barlow-condensed)]"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="flex items-center gap-1.5 text-xs text-mid/60 hover:text-cyan transition-colors font-[family-name:var(--font-barlow-condensed)]"
              >
                <ExternalLink className="size-3.5" />
                {social.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
