const updatedAt = "January 6, 2026";

export default function PrivacyPage() {
  return (
    <div className="container max-w-4xl pt-24 pb-16 text-slate-900 dark:text-slate-100">
      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">InsightScoop Privacy Policy</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Last updated: {updatedAt}</p>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            InsightScoop, a Yardura service, respects your privacy. This Privacy Policy
            explains what data we collect, how we use it, who we share it with, and
            the controls you have. If you have any questions, email
            {" "}
            <a
              href="mailto:privacy@yardura.com"
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              privacy@yardura.com
            </a>
            .
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">1. Information We Collect</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Information you provide.</span>
              Contact details (name, email, phone, address), household and pet details,
              service preferences, notes for our technicians, and communications you send to
              us. Payment information is collected and processed by trusted third-party
              processors; we store only the last four digits and card type for reference.
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Information collected automatically.</span>
              When you use our site or quote tools we log device identifiers, IP address,
              browser type, pages viewed, referring URLs, and approximate location. We also
              record product interactions (such as button clicks) to improve the experience.
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">Information from partners.</span>
              We may receive lead referrals from marketing partners, enrichment data from
              address verification providers, or updates from payment processors, analytics
              platforms, or customer support tools to help us deliver service responsibly.
            </li>
            <li>
              <span className="font-semibold text-slate-900 dark:text-slate-100">In-app purchase data.</span>
              Subscription status, product identifiers, and renewal or expiration dates from
              Apple/Google and RevenueCat. We do not receive or store full payment card details
              for in-app purchases.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">2. How We Use Your Information</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>Provide quotes, schedule visits, process payments, and deliver services.</li>
            <li>Send confirmations, reminders, service summaries, wellness updates, and invoices.</li>
            <li>Operate, maintain, and improve our websites, apps, and routing technology.</li>
            <li>Personalize offers, measure campaign performance, and deliver relevant marketing when permitted.</li>
            <li>Detect and prevent fraud, enforce our Terms of Service, and comply with legal obligations.</li>
            <li>Respond to customer service inquiries and support your account preferences.</li>
          </ul>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Where required by law, we rely on your consent to send marketing
            communications, on contractual necessity to deliver services you request,
            and on legitimate interests to improve our operations and protect InsightScoop,
            our technicians, and our customers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">3. Sharing & Disclosure</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We do not sell your personal information. We may share limited data with trusted
            service providers that help us operate InsightScoop (payment processors,
            customer service tools, email/SMS platforms, analytics and advertising partners)
            under contractual agreements that protect your data. We may also disclose
            information if required by law or to enforce our terms.
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            In the event of a business transaction such as a merger, financing, or
            acquisition, your information may be transferred as part of that process,
            subject to the same privacy commitments.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">4. Cookies & Analytics</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We use cookies, pixels, and similar technologies for essential site
            functionality, analytics, and advertising. Non-essential cookies are only loaded
            after you provide consent through our cookie banner. You can adjust preferences at
            any time via the “Cookie preferences” button in the footer. For full details, read our
            <a
              href="/cookies"
              className="ml-1 font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              Cookie Policy
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">5. Marketing Communications</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We send marketing emails or SMS messages only if you opt in. You can unsubscribe
            at any time using the links provided in our emails or by replying STOP to SMS.
            We may continue to send transactional or service-related messages even if you
            opt out of marketing.
          </p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            By providing a phone number, you consent to receiving calls and text messages
            from InsightScoop and our service providers about services, scheduling, and
            promotions. Message and data rates may apply. Reply HELP for assistance or STOP
            to opt out of further marketing texts.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">6. Data Security & Retention</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We implement reasonable technical and organizational measures to protect your data.
            Despite these safeguards, no system is perfectly secure. We retain personal
            information for as long as necessary to provide services, comply with laws, resolve
            disputes, or enforce agreements. Retention periods vary by data type and take into
            account legal requirements, financial record-keeping obligations, and the nature of
            our relationship with you.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">7. Your Rights & Choices</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>Access, correct, or update your personal information.</li>
            <li>Request deletion of your data, subject to legal or contractual obligations.</li>
            <li>Opt out of marketing communications and certain analytics or advertising cookies.</li>
            <li>Request a portable copy of the information you provided.</li>
            <li>Limit or object to certain processing activities where applicable law provides that right.</li>
          </ul>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Residents of California, Colorado, Connecticut, Utah, Virginia, and other regions
            with data privacy laws may have additional rights. We will honor all valid requests
            submitted to {" "}
            <a
              href="mailto:privacy@yardura.com"
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              privacy@yardura.com
            </a>
            {" "}or by writing to the address below. We may verify your identity before completing
            a request and may decline certain requests where allowed by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">8. Children</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            InsightScoop is not intended for children under 13. We do not knowingly collect
            personal information from children. If you believe a child has provided us data,
            please contact us so we can remove it.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">9. International Data Transfers</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            InsightScoop is located in the United States. If you access our services from
            another country, your information may be transferred to, stored, and processed in
            the United States or other jurisdictions where our service providers operate. We
            take appropriate safeguards to protect your information consistent with applicable
            laws.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">10. Changes to This Policy</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We may update this Privacy Policy to reflect operational or legal changes. We will
            post updates on this page with a new effective date. Significant changes may also
            be communicated via email or service notifications.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">11. Contact Us</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Questions about this policy? Email
            {" "}
            <a
              href="mailto:privacy@yardura.com"
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              privacy@yardura.com
            </a>
            {" "}or write to Yardura, Attn: Privacy, 5632 Morgan Ave S, Minneapolis, MN 55419.
          </p>
        </section>
      </div>
    </div>
  );
}
