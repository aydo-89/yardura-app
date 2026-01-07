import Link from "next/link";

export default function GoodbyePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgba(var(--vanilla-rgb-commas),0.3)] px-6 py-16">
      <div className="max-w-lg rounded-3xl bg-white p-10 text-center shadow-xl ring-1 ring-[rgba(var(--graphite-rgb-commas),0.08)]">
        <h1 className="text-3xl font-heading font-semibold text-ink">
          We’re sorry to see you go
        </h1>
        <p className="mt-4 text-sm text-[rgba(var(--graphite-rgb-commas),0.7)]">
          Your membership will remain active until the end of the current billing period.
          If you change your mind, we’d be thrilled to help you get set up again.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-[hsl(var(--brand-coral))] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[hsl(var(--brand-coral-ink))]"
          >
            Return home
          </Link>
          <Link
            href="mailto:hello@yardura.com"
            className="inline-flex items-center justify-center rounded-full border border-[rgba(var(--graphite-rgb-commas),0.15)] px-6 py-2 text-sm font-semibold text-[rgba(var(--graphite-rgb-commas),0.75)] transition hover:bg-[rgba(var(--graphite-rgb-commas),0.05)]"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
