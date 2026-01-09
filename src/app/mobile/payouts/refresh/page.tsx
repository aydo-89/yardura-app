"use client";

import { useEffect } from "react";

const APP_URL = "insightscoop://earnings?stripe=refresh";

export default function MobilePayoutRefreshPage() {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      window.location.href = APP_URL;
    }, 400);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-6 py-16 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-8 text-center shadow-2xl shadow-black/40">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-300">
          Payout setup
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-white">
          Setup link expired
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Return to the InsightScoop app to restart Stripe Express onboarding and finish
          setting up payouts.
        </p>
        <a
          href={APP_URL}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
        >
          Open the app
        </a>
        <p className="mt-4 text-xs text-slate-400">
          If asked to sign in, use the email on your scooper profile. If the button does not
          work, close this tab and reopen the app from your home screen.
        </p>
      </div>
    </main>
  );
}
