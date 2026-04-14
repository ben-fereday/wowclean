import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | WowClean Calgary",
  description:
    "Terms of Service for WowClean Calgary mobile auto detailing.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen pt-[72px]">
      <section className="bg-dark py-20 px-6 text-center">
        <p className="font-[family-name:var(--font-barlow-condensed)] text-xs font-bold tracking-[3px] uppercase text-cyan mb-4">
          Legal
        </p>
        <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-7xl tracking-wider text-white mb-4">
          Terms of <span className="text-cyan">Service</span>
        </h1>
        <p className="text-mid text-sm">Last updated: April 10, 2026</p>
      </section>

      <section className="bg-navy py-20 px-6">
        <div className="max-w-3xl mx-auto prose-invert text-silver leading-relaxed space-y-8">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              1. Agreement
            </h2>
            <p>
              By booking or using services provided by WowClean
              (&ldquo;WowClean&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or
              &ldquo;us&rdquo;), you agree to be bound by these Terms of
              Service. If you do not agree, please do not use our services or
              website.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              2. Services
            </h2>
            <p>
              WowClean provides mobile auto detailing services in Calgary, AB
              and surrounding areas. Service availability, pricing, and
              turnaround times are subject to change without notice. We
              reserve the right to refuse service for any reason, including
              unsafe working conditions or vehicles requiring work beyond our
              scope.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              3. Bookings &amp; Payment
            </h2>
            <p>
              Appointments can be booked online, by phone, or via email. By
              placing a booking you authorize us to hold the requested time
              slot. Payment is due upon completion of service unless otherwise
              agreed in writing. We accept major credit cards, debit, and
              e-transfer.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              4. Cancellations &amp; Rescheduling
            </h2>
            <p>
              Please provide at least 24 hours notice to cancel or reschedule
              an appointment. Late cancellations or no-shows may be subject to
              a fee. Weather, unsafe conditions, or circumstances beyond our
              control may require us to reschedule; we will contact you as
              soon as possible.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              5. Vehicle Condition &amp; Personal Items
            </h2>
            <p>
              You are responsible for removing all valuables and personal
              items from your vehicle prior to service. WowClean is not liable
              for lost, stolen, or damaged personal items left in the vehicle.
              We will inspect the vehicle before starting work and note any
              pre-existing damage.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              6. Satisfaction &amp; Refunds
            </h2>
            <p>
              Your satisfaction is important to us. If you are not happy with
              the results, please let us know within 24 hours of service
              completion and we will do our best to make it right. Refunds
              are handled on a case-by-case basis at our discretion.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              7. Limitation of Liability
            </h2>
            <p>
              WowClean&apos;s total liability for any claim arising from our
              services shall not exceed the amount paid for the specific
              service in question. We are not liable for indirect,
              incidental, or consequential damages.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              8. Changes to These Terms
            </h2>
            <p>
              We may update these Terms from time to time. Continued use of
              our services after changes constitutes acceptance of the
              updated Terms.
            </p>
          </div>

          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-2xl tracking-wider text-white mb-3">
              9. Contact
            </h2>
            <p>
              Questions about these Terms? Contact us at{" "}
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
