"use client";

import React, { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

function OnboardingStartContent() {
  const searchParams = useSearchParams();
  const params = searchParams ?? new URLSearchParams();
  const router = useRouter();

  const leadId = params.get("leadId");
  const rawBillingPreference = (params.get("billingPreference") ?? "").toLowerCase();

  const billingPreference =
    rawBillingPreference === "weekly"
      ? "weekly"
      : rawBillingPreference === "per-visit" || rawBillingPreference === "pervisit"
        ? "weekly"
        : rawBillingPreference === "monthly"
          ? "monthly"
          : null;

  useEffect(() => {
    if (!leadId) {
      router.replace("/quote?businessId=yardura");
      return;
    }

    if (billingPreference) {
      try {
        sessionStorage.setItem("billingPreference", billingPreference);
      } catch (error) {
        console.warn(
          "Unable to persist billing preference on onboarding start",
          error,
        );
      }
    }

    const nextParams = new URLSearchParams({ leadId });
    if (billingPreference) {
      nextParams.set("billingPreference", billingPreference);
    }

    router.replace(`/onboarding/setup?${nextParams.toString()}`);
  }, [billingPreference, leadId, router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-coral" />
        <div className="mt-6 space-y-2">
          <p className="text-lg font-serif font-semibold text-slate-900 dark:text-white">
            Redirecting you to finish your setup…
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Hang tight while we load your onboarding details.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingStartPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-coral" />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Loading…</p>
          </div>
        </div>
      }
    >
      <OnboardingStartContent />
    </Suspense>
  );
}
