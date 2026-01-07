const updatedAt = "January 6, 2026";

export default function BillingTermsPage() {
  return (
    <div className="container max-w-3xl py-16 text-slate-900 dark:text-slate-100">
      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">Billing &amp; Cancellation Policy</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Last updated: {updatedAt}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This policy covers Premium Wellness subscriptions and scooping service billing.
            For questions, email{" "}
            <a
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
              href="mailto:hello@yardura.com"
            >
              hello@yardura.com
            </a>
            .
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">1. Premium Wellness (In-App Subscription)</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              Premium Wellness is an auto-renewing subscription priced at $19.99 per month (USD).
            </li>
            <li>
              Payment is charged to your Apple ID at confirmation of purchase. Renewal occurs
              automatically unless you cancel at least 24 hours before the end of the current
              billing period.
            </li>
            <li>
              You can manage or cancel your subscription in your App Store account settings.
            </li>
            <li>
              Refunds for in-app purchases are handled by Apple under their refund policy.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">2. Scooping Service Billing</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              Scooping services are physical services billed separately based on your selected
              frequency, yard size, and add-ons.
            </li>
            <li>
              Payment methods are stored securely with our payment processor. We do not store
              full card details on our servers.
            </li>
            <li>
              Add-ons (deodorizer, compost routing, extra areas, additional dogs) update your
              per-visit cost immediately after confirmation.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">3. Cancellations &amp; Changes</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              You can pause, skip, or cancel scooping service at any time through your account
              or by contacting support. Same-day changes may be billed due to route planning.
            </li>
            <li>
              Premium Wellness subscriptions are managed through the App Store for iOS purchases
              or the billing portal for web purchases.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">4. Contact</h2>
          <p className="text-slate-600 dark:text-slate-300">
            Need help with billing or cancellations? Email{" "}
            <a
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
              href="mailto:hello@yardura.com"
            >
              hello@yardura.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
