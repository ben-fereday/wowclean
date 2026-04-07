import { Phone, Mail, MapPin, Clock } from "lucide-react";
import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen pt-[72px]">
      {/* Hero */}
      <section className="bg-dark py-20 px-6 text-center">
        <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-cyan mb-4">
          Get In Touch
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-7xl tracking-wider text-white mb-4">
          Contact <span className="text-cyan">WOW CLEAN</span>
        </h1>
        <p className="text-mid max-w-lg mx-auto leading-relaxed">
          Have questions about our services? Want a custom quote? We&apos;re here to help.
        </p>
      </section>

      <section className="bg-navy py-20 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl tracking-wider text-white mb-8">
              Reach <span className="text-cyan">Us</span>
            </h2>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue/20 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-cyan" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-barlow-condensed)] text-sm font-bold tracking-wider uppercase text-silver mb-1">
                    Phone
                  </h3>
                  <a
                    href="tel:14035555555"
                    className="font-[family-name:var(--font-heading)] text-2xl text-cyan tracking-wider hover:opacity-80 transition-opacity"
                  >
                    (403) 555-5555
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue/20 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-cyan" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-barlow-condensed)] text-sm font-bold tracking-wider uppercase text-silver mb-1">
                    Email
                  </h3>
                  <a
                    href="mailto:info@wowclean.ca"
                    className="text-cyan hover:opacity-80 transition-opacity"
                  >
                    info@wowclean.ca
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue/20 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-cyan" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-barlow-condensed)] text-sm font-bold tracking-wider uppercase text-silver mb-1">
                    Service Area
                  </h3>
                  <p className="text-silver">
                    Calgary &amp; surrounding areas
                    <br />
                    <span className="text-mid text-sm">
                      Airdrie, Cochrane, Okotoks, Chestermere
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-cyan" />
                </div>
                <div>
                  <h3 className="font-[family-name:var(--font-barlow-condensed)] text-sm font-bold tracking-wider uppercase text-silver mb-1">
                    Hours
                  </h3>
                  <p className="text-silver">
                    Monday – Saturday: 7:00 AM – 8:00 PM
                    <br />
                    <span className="text-mid text-sm">Sunday: Closed</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Card */}
          <div className="bg-dark/50 border border-white/[0.08] rounded-2xl p-8 flex flex-col justify-center">
            <h2 className="font-[family-name:var(--font-heading)] text-3xl tracking-wider text-white mb-4">
              Ready to <span className="text-cyan">Book?</span>
            </h2>
            <p className="text-mid leading-relaxed mb-8">
              Skip the phone call and book your detail online in minutes. Choose
              your package, pick a time, and we&apos;ll take care of the rest.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/book"
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-lg font-bold tracking-wider uppercase px-8 py-4 rounded-lg shadow-[0_0_40px_rgba(26,74,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] transition-all"
              >
                Book Online
              </Link>
              <a
                href="tel:14035555555"
                className="inline-flex items-center justify-center gap-2 border border-white/[0.15] text-white font-[family-name:var(--font-barlow-condensed)] text-lg font-semibold tracking-wider uppercase px-8 py-4 rounded-lg hover:border-cyan hover:text-cyan transition-all"
              >
                <Phone className="w-4 h-4" />
                Call Us
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
