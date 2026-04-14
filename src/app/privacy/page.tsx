import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | WowClean Calgary",
  description:
    "Privacy Policy for WowClean Calgary mobile auto detailing.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen pt-[72px]">
      <section className="bg-dark py-20 px-6 text-center">
        <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-cyan mb-4">
          Legal
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-7xl tracking-wider text-white mb-4">
          Privacy <span className="text-cyan">Policy</span>
        </h1>
        <p className="text-mid text-sm">Last updated: April 10, 2026</p>
      </section>

      <section className="bg-navy py-20 px-6">
        <div className="max-w-3xl mx-auto text-silver leading-relaxed space-y-8">
          <div>
            <p>
              WowClean (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or
              &ldquo;us&rdquo;) respects your privacy. This Privacy Policy
              explains what information we collect, how we use it, and the
              choices you have.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              1. Information We Collect
            </h2>
            <p>
              We collect information you provide directly when you book a
              service, create an account, or contact us. This may include
              your name, email address, phone number, service address,
              vehicle details, and payment information. We may also collect
              basic usage data (pages visited, device type) through standard
              website analytics.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              2. How We Use Your Information
            </h2>
            <p>
              We use your information to schedule and deliver services,
              process payments, send booking confirmations and reminders,
              respond to inquiries, and improve our services. We may also
              send occasional service updates or promotions — you can opt
              out at any time.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              3. Sharing Your Information
            </h2>
            <p>
              We do not sell your personal information. We share information
              only with trusted service providers who help us operate our
              business (for example, payment processors, email delivery, and
              hosting providers), and only as needed to provide services to
              you. We may also disclose information if required by law.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              4. Data Security
            </h2>
            <p>
              We take reasonable steps to protect your information, including
              secure hosting and encrypted connections. No method of
              transmission over the internet is 100% secure, but we work to
              use industry-standard safeguards.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              5. Cookies
            </h2>
            <p>
              Our website uses cookies and similar technologies to keep you
              signed in, remember preferences, and analyze site traffic. You
              can control cookies through your browser settings.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              6. Your Rights
            </h2>
            <p>
              You may request access to, correction of, or deletion of your
              personal information at any time by contacting us. We will
              respond within a reasonable timeframe as required by
              applicable law.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              7. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Changes
              will be posted on this page with a new &ldquo;last
              updated&rdquo; date.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              8. Contact
            </h2>
            <p>
              Questions about this Privacy Policy? Contact us at{" "}
              <a
                href="mailto:teamwowclean@gmail.com"
                className="text-cyan hover:underline"
              >
                teamwowclean@gmail.com
              </a>{" "}
              or (587) 891-3265.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
