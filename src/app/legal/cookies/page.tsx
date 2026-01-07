const updatedAt = "January 6, 2026";

export default function CookiePolicyPage() {
  return (
    <div className="container max-w-4xl pt-24 pb-16 text-slate-900 dark:text-slate-100">
      <div className="space-y-6">
        <header className="space-y-3">
          <h1 className="text-3xl font-bold">InsightScoop Cookie Policy</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Last updated: {updatedAt}</p>
          <p className="text-base leading-relaxed text-slate-600 dark:text-slate-300">
            This Cookie Policy explains how InsightScoop (operated by Yardura) uses cookies
            and similar technologies on our website. It should be read together with our
            <a
              href="/privacy"
              className="ml-1 font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">1. What Are Cookies?</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Cookies are small text files stored on your device when you visit a website. They
            help site owners provide a more secure and personalized experience. Pixels, tags,
            and scripts perform similar functions and are collectively referred to as cookies in
            this policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">2. Cookies We Use</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              <span className="font-semibold text-brand-coral dark:text-brand-mint">Essential cookies</span> enable
              core functionality such as remembering quote progress, securing forms, and
              authenticating dashboard access.
            </li>
            <li>
              <span className="font-semibold text-brand-coral dark:text-brand-mint">Analytics cookies</span> (Google
              Analytics 4, Microsoft Clarity) help us understand how visitors use our site so we
              can improve content and performance.
            </li>
            <li>
              <span className="font-semibold text-brand-coral dark:text-brand-mint">Advertising cookies</span> (Meta
              Pixel, Google Ads remarketing) allow us to show relevant ads to people who are
              interested in InsightScoop services.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">3. Consent & Preferences</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We only activate analytics and advertising cookies after you provide consent via the
            cookie banner. You can update your choices at any time by selecting “Cookie
            preferences” in the website footer. Essential cookies are always active because the
            site cannot function properly without them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">4. Managing Cookies</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            In addition to using our on-site tools, you can control cookies through your browser
            settings. Most browsers allow you to block or delete cookies. Please note that
            disabling essential cookies may impact site functionality.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">5. Do-Not-Track Signals</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Some browsers offer a Do-Not-Track (DNT) feature that indicates you prefer not to be
            tracked. Because there is no common industry standard, InsightScoop does not
            currently respond to DNT signals. We continue to evaluate emerging protocols.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">6. Updates</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            We may update this Cookie Policy to reflect changes in technology, law, or our
            services. Updates will be posted here with a new effective date.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">7. Contact</h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Questions about cookies? Email
            {" "}
            <a
              href="mailto:privacy@yardura.com"
              className="font-semibold text-brand-coral dark:text-brand-mint underline-offset-2 hover:underline"
            >
              privacy@yardura.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
