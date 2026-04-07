"use client";

import { useState } from "react";
import { Phone, Mail, MapPin, Clock, Send, Check } from "lucide-react";
import Link from "next/link";
import { sendContactMessage } from "./actions";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);

    const result = await sendContactMessage({ name, email, phone, message });

    setSending(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
  }

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
                    href="tel:15874369605"
                    className="font-[family-name:var(--font-heading)] text-2xl text-cyan tracking-wider hover:opacity-80 transition-opacity"
                  >
                    (587) 436-9605
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
                    href="mailto:info@wowcleancalgary.com"
                    className="text-cyan hover:opacity-80 transition-opacity"
                  >
                    info@wowcleancalgary.com
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

          {/* Contact Form */}
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl tracking-wider text-white mb-8">
              Send a <span className="text-cyan">Message</span>
            </h2>

            {sent ? (
              <div className="bg-dark/50 border border-cyan/20 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-cyan/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-cyan" />
                </div>
                <h3 className="font-[family-name:var(--font-heading)] text-2xl text-white tracking-wider mb-2">
                  Message Sent!
                </h3>
                <p className="text-mid">
                  We&apos;ll get back to you as soon as possible.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <div>
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[2px] uppercase text-mid mb-1.5 block">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-white/5 border border-white/[0.12] rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan transition-colors placeholder:text-mid"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[2px] uppercase text-mid mb-1.5 block">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full bg-white/5 border border-white/[0.12] rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan transition-colors placeholder:text-mid"
                    />
                  </div>
                  <div>
                    <label className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[2px] uppercase text-mid mb-1.5 block">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(587) 000-0000"
                      className="w-full bg-white/5 border border-white/[0.12] rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan transition-colors placeholder:text-mid"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[2px] uppercase text-mid mb-1.5 block">
                    Message *
                  </label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what you need..."
                    rows={5}
                    className="w-full bg-white/5 border border-white/[0.12] rounded-lg px-4 py-3 text-white text-sm outline-none focus:border-cyan transition-colors placeholder:text-mid resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-blue2 to-blue text-white font-[family-name:var(--font-barlow-condensed)] text-lg font-bold tracking-wider uppercase px-8 py-4 rounded-lg shadow-[0_0_40px_rgba(26,74,255,0.4)] hover:translate-y-[-2px] hover:shadow-[0_0_60px_rgba(26,74,255,0.6)] transition-all disabled:opacity-50 disabled:translate-y-0"
                >
                  {sending ? "Sending..." : <><Send className="w-4 h-4" /> Send Message</>}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
