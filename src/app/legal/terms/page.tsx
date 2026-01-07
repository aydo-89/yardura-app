const updatedAt = "January 6, 2026";

export default function TermsPage() {
  return (
    <div className="container max-w-4xl pt-24 pb-16 text-slate-900 dark:text-slate-100">
      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">InsightScoop Terms of Service</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Last updated: {updatedAt}</p>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            InsightScoop is a Yardura service that combines pet waste removal with
            weekly wellness reporting. By accessing or using our website, submitting
            a quote request, or receiving service, you agree to the terms and
            conditions below. Services renew on a recurring basis until you or
            InsightScoop cancels them in accordance with these terms. If you have
            questions, please contact {" "}
            <a
              href="mailto:hello@yardura.com"
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              hello@yardura.com
            </a>
            .
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">1. Eligibility & Accounts</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              You must be at least 18 years old and able to enter into a binding
              contract to request InsightScoop services.
            </li>
            <li>
              Creating an account is optional. If you register, you are responsible
              for maintaining the confidentiality of your login credentials and for
              all activity that occurs under your account.
            </li>
            <li>
              You represent that all information you provide about your property,
              pets, and billing is accurate and current, and you agree to update it
              promptly if it changes.
            </li>
          </ul>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            Scoopers who provide services through the marketplace are independent contractors
            and are subject to the{" "}
            <a
              href="/scooper-terms"
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              Scooper Marketplace Terms
            </a>
            .
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">2. Quotes, Term & Renewal</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              Online quotes are generated from the information you provide about
              your pets, yard, and desired cadence. InsightScoop may verify details
              in person and adjust pricing if conditions differ materially. Quotes
              are valid for 30 days unless otherwise noted.
            </li>
            <li>
              Upon accepting a quote or scheduling service, you authorize
              InsightScoop to begin recurring service at the cadence shown in your
              confirmation. Services continue until cancelled in writing, through
              your account, or by contacting our team.
            </li>
            <li>
              Commercial accounts may have additional terms in a separate service
              agreement. In the event of a conflict, the executed agreement governs.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">3. Scheduling & Service Window</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              Service routes are organized by geography. We are unable to guarantee
              a specific time, but most visits occur between sunrise and sunset on
              your assigned service day.
            </li>
            <li>
              We work in most weather conditions. If severe weather, extreme
              temperatures, unsafe road conditions, or other events outside our
              control prevent service, we will notify you and reschedule or credit
              the visit as appropriate.
            </li>
            <li>
              Public holidays observed by InsightScoop may shift your service day.
              We will communicate holiday schedules in advance.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">4. Access & Safety Responsibilities</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              Provide safe, unobstructed access to the areas InsightScoop is
              scheduled to service. Gates must be unlocked and free of snow, ice,
              debris, or hazards when we arrive.
            </li>
            <li>
              Restrain pets that are not accustomed to our technicians. We may
              decline or end a visit if an animal is aggressive or if a technician
              feels unsafe. You are responsible for any veterinary or medical
              expenses arising from animal bites or injuries on your property.
            </li>
            <li>
              Remove large debris, yard equipment, or other obstacles that prevent
              us from completing service. If we cannot access the yard, the visit
              may be billed in full.
            </li>
            <li>
              InsightScoop technicians document service with proof photos and sanitation
              confirmation. Invalid or inaccurate proof may result in reduced compensation,
              return visits, or removal of a technician from routes or the platform.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">5. Billing, Payments & Fees</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              Payment is due based on the billing plan shown in your confirmation
              (per visit, monthly, or prepaid). Where required, applicable sales tax
              is added to service fees.
            </li>
            <li>
              You authorize InsightScoop to charge the payment method on file for
              all scheduled visits and any approved add-ons. If a payment is
              declined, you agree to update the payment method within ten (10)
              business days of notice to avoid service interruption.
            </li>
            <li>
              Late balances may incur reasonable collection costs, including
              attorney fees, to bring the account current.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">6. Premium Wellness Subscriptions</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              Premium Wellness subscriptions purchased in the iOS app are billed by Apple.
              You can manage or cancel them from your App Store account settings.
            </li>
            <li>
              Subscriptions auto-renew monthly unless canceled at least 24 hours before the
              end of the current billing period.
            </li>
            <li>
              Refunds for in-app purchases are handled by Apple under their refund policy.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">7. Cancellations, Skips & Refunds</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              You may pause, skip, or cancel recurring service at any time without
              penalty by contacting us at least 24 hours before your scheduled
              visit. Same-day cancellations may be billed due to route planning.
            </li>
            <li>
              If InsightScoop is unable to complete service due to our error, we
              will revisit promptly or apply a credit. Refunds are issued only when
              appropriate after deducting processing costs for payments already
              settled with our processors.
            </li>
            <li>
              Account credits issued by InsightScoop do not expire and will be
              applied to future invoices unless you request otherwise.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">8. Satisfaction Guarantee</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              If you are not satisfied with a visit, contact us within 24 hours and
              we will revisit the same or next available day at no additional cost.
              After 24 hours, revisits may incur a fee.
            </li>
            <li>
              We always aim to resolve concerns within the guidelines of this
              policy and your specific service agreement.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">9. Health Insights & Disclaimers</h2>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            InsightScoop wellness summaries and stool observations are informational
            only. They are not veterinary advice, diagnosis, or treatment. Always
            consult a licensed veterinarian regarding your pet&rsquo;s health. You
            remain responsible for decisions you make using the information we
            provide.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">10. Communications & Consent</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              By supplying contact information, you consent to receiving service
              communications via email, phone, and SMS. Message and data rates may
              apply. Reply STOP to SMS at any time to opt out of marketing texts.
            </li>
            <li>
              With your permission, we may deliver invoices, notices, and other
              service documents electronically. You may change your preference at
              any time by contacting us.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">11. Modifications, Pricing & Force Majeure</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              InsightScoop may update services, pricing, or these terms by
              providing notice at least 30 days in advance when changes are
              material. Continued service after the effective date constitutes
              acceptance.
            </li>
            <li>
              We are not responsible for delays or cancellations caused by events
              beyond our reasonable control, including severe weather, natural
              disasters, utility failures, labor disruptions, or acts of
              governmental authorities.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">12. Insurance & Limitation of Liability</h2>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            InsightScoop maintains required licenses and at least $1,000,000 in
            general liability coverage. To the fullest extent permitted by law,
            InsightScoop and Yardura are not liable for indirect, incidental,
            special, or consequential damages arising from your use of the service.
            Our total liability for any claim is limited to the fees you paid for
            the service at issue in the preceding three months.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">13. Dispute Resolution</h2>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            These terms are governed by Minnesota law without regard to conflict of
            law principles. If a dispute arises, the parties will first attempt to
            resolve it through informal discussions. If unresolved, either party
            may request non-binding mediation in Minneapolis, Minnesota before
            pursuing other remedies. You agree to waive jury trials in any
            proceeding arising from these terms. Collection activities for unpaid
            balances are exempt from this mediation requirement.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">14. Entire Agreement & Severability</h2>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            These Terms of Service constitute the entire agreement between you and
            InsightScoop regarding residential services and supersede any prior
            agreements or representations. If any provision is found unenforceable,
            the remaining provisions remain in full force and effect. InsightScoop&rsquo;s
            failure to enforce a provision does not waive its right to do so later.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-2xl font-semibold">15. Contact</h2>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300">
            For questions about these Terms of Service, email {" "}
            <a
              href="mailto:hello@yardura.com"
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              hello@yardura.com
            </a>
            {" "}or call 1-877-417-YARD.
          </p>
        </section>
      </div>
    </div>
  );
}
