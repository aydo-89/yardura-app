"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  CheckCircle,
  Calendar,
  MapPin,
  AlertCircle,
  Loader2,
  ArrowRight,
  Smartphone,
  ChevronDown,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatServiceDate,
  extractPreferredTimeWindow,
  resolvePreferredTimeWindowShortLabel,
} from "@/lib/time-window";
import { cn } from "@/lib/utils";

interface SubscriptionData {
  subscriptionId: string;
  customerId: string;
  nextBillingDate: string | null;
  firstVisitDate: string | null;
  firstVisitTime: string;
  firstVisitTimeWindow?: string | null;
  firstVisitTimeWindowSlug?: string | null;
  serviceAddress: string;
}

function OnboardingCompleteContent() {
  const searchParams = useSearchParams();
  const params = searchParams ?? new URLSearchParams();
  const router = useRouter();
  const [subscriptionData, setSubscriptionData] =
    useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Debug: Log when component renders
  console.log("[ONBOARDING] Component render", { isLoading, hasData: !!subscriptionData });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signInError, setSignInError] = useState("");
  
  // Password creation state (optional, for web access)
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isCreatingPassword, setIsCreatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const leadId = params.get("leadId");
  const setupIntentParam = params.get("setup_intent");
  const amountParam = params.get("amount");

  const initialSetupIntentId = setupIntentParam?.includes("_secret_")
    ? setupIntentParam.split("_secret_")[0]
    : setupIntentParam;
  const parsedAmountFromQuery = amountParam
    ? Number.parseInt(amountParam, 10)
    : NaN;
  const normalizedAmountFromQuery = Number.isFinite(parsedAmountFromQuery)
    ? Math.round(parsedAmountFromQuery)
    : null;

  const [effectiveSetupIntentId, setEffectiveSetupIntentId] =
    useState<string | null>(initialSetupIntentId || null);
  const [effectiveAmountCents, setEffectiveAmountCents] =
    useState<number | null>(normalizedAmountFromQuery);
  const [attemptedRestore, setAttemptedRestore] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isMountedRef = React.useRef(true);
  const hasSubmittedRef = React.useRef(false);

  // Only mark unmounted on *actual* unmount (not on dependency-change re-runs).
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const firstVisitDateDisplay =
    formatServiceDate(subscriptionData?.firstVisitDate, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }) ?? "To be scheduled";

  const { slug: firstVisitWindowSlug, label: firstVisitWindowLabel } =
    extractPreferredTimeWindow(
      {
        preferredTimeWindowSlug: subscriptionData?.firstVisitTimeWindowSlug,
        preferredTimeWindow: subscriptionData?.firstVisitTimeWindow ?? null,
      },
      subscriptionData?.firstVisitTimeWindow ?? null,
    );
  const resolvedWindowShortLabel = resolvePreferredTimeWindowShortLabel(
    firstVisitWindowSlug,
    firstVisitWindowLabel,
  );
  const firstVisitTimeDisplay = resolvedWindowShortLabel
    ? `${resolvedWindowShortLabel} window`
    : "Flexible window";

  const nextBillingDateDisplay =
    formatServiceDate(subscriptionData?.nextBillingDate) ?? "To be scheduled";

  useEffect(() => {
    if (attemptedRestore) return;

    try {
      if (!effectiveSetupIntentId) {
        const storedSetupIntentId = sessionStorage.getItem("setupIntentId");
        if (storedSetupIntentId) {
          setEffectiveSetupIntentId(storedSetupIntentId);
        }
      }

      if (effectiveAmountCents == null) {
        const storedAmount = sessionStorage.getItem("todaysChargeCents");
        if (storedAmount) {
          const parsed = Number.parseInt(storedAmount, 10);
          if (!Number.isNaN(parsed)) {
            setEffectiveAmountCents(parsed);
          }
        }
      }
    } catch (storageError) {
      console.warn("Unable to restore onboarding completion data", storageError);
    } finally {
      setAttemptedRestore(true);
    }
  }, [attemptedRestore, effectiveSetupIntentId, effectiveAmountCents]);

  useEffect(() => {
    console.log("[ONBOARDING] useEffect triggered", { leadId, attemptedRestore, effectiveSetupIntentId, hasSubmitted });
    
    if (!leadId) {
      router.push("/quote?businessId=yardura");
      return;
    }

    if (!attemptedRestore) {
      console.log("[ONBOARDING] Waiting for attemptedRestore");
      return;
    }

    if (!effectiveSetupIntentId) {
      console.warn(
        "Missing setup intent id for onboarding completion, redirecting to setup",
      );
      router.push(`/onboarding/setup?leadId=${leadId}`);
      return;
    }

    if (hasSubmitted) {
      console.log("[ONBOARDING] Already submitted, skipping");
      return;
    }

    console.log("[ONBOARDING] Starting completeOnboarding...");
    if (hasSubmittedRef.current) {
      console.log("[ONBOARDING] Already submitted (ref), skipping");
      return;
    }
    hasSubmittedRef.current = true;
    setHasSubmitted(true);

    completeOnboarding(
      effectiveSetupIntentId,
      effectiveAmountCents ?? undefined,
    );
  }, [
    leadId,
    attemptedRestore,
    effectiveSetupIntentId,
    effectiveAmountCents,
    router,
  ]);

  const performPasswordSignIn = async ({
    email,
    password,
  }: {
    email: string | null;
    password?: string | null;
  }): Promise<boolean> => {
    if (!email || !password) {
      return false;
    }

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.ok) {
        router.replace(result.url ?? "/dashboard");
        return true;
      }

      setSignInError(
        result?.error ||
          "We couldn't sign you in with that password. You can still access your account from the sign-in page.",
      );
      return false;
    } catch (error) {
      console.error("Auto sign-in failed:", error);
      setSignInError(
        "We couldn't sign you in automatically. Please open the confirmation email we just sent to finish signing in.",
      );
      return false;
    }
  };

  const completeOnboarding = async (
    setupIntentIdValue: string,
    amountCentsValue?: number,
  ) => {
    try {
      if (!leadId || !setupIntentIdValue) {
        throw new Error("Missing required information. Please go back and complete payment setup.");
      }

      const scheduledDate = sessionStorage.getItem("selectedServiceDate");
      const timeWindowPreference = sessionStorage.getItem("selectedServiceWindow");
      const authMethod = sessionStorage.getItem("authMethod");
      const password = sessionStorage.getItem("userPassword");
      const dogDoor = sessionStorage.getItem("dogDoor");
      const dogsOutside = sessionStorage.getItem("dogsOutside");
      const cleanWithDogs = sessionStorage.getItem("cleanWithDogs");
      const gateLocation = sessionStorage.getItem("gateLocation");
      const gateLocationNotes = sessionStorage.getItem("gateLocationNotes");
      const trashLocation = sessionStorage.getItem("trashLocation");
      const trashLocationNotes = sessionStorage.getItem("trashLocationNotes");
      const communityGateAccess = sessionStorage.getItem("communityGateAccess");
      const communityGateCode = sessionStorage.getItem("communityGateCode");
      const homeGateAccess = sessionStorage.getItem("homeGateAccess");
      const homeGateCode = sessionStorage.getItem("homeGateCode");
      const accessNotes = sessionStorage.getItem("accessNotes");
      const storedLeadEmail = sessionStorage.getItem("leadEmail");

      const amountCentsToSend =
        typeof amountCentsValue === "number" && Number.isFinite(amountCentsValue)
          ? Math.round(amountCentsValue)
          : undefined;

      console.log("[ONBOARDING] Making POST request to /api/onboarding/complete");
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          setupIntentId: setupIntentIdValue,
          scheduledDate,
          amount: amountCentsToSend,
          authMethod,
          password,
          billingPreference:
            sessionStorage.getItem("billingPreference") === "weekly"
              ? "weekly"
              : "monthly",
          timeWindowPreference,
          dogDoor,
          dogsOutside,
          cleanWithDogs,
          gateLocation,
          gateLocationNotes,
          trashLocation,
          trashLocationNotes,
          communityGateAccess,
          communityGateCode,
          homeGateAccess,
          homeGateCode,
          accessNotes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));

        if (response.status === 400 && errorData.error?.includes("Payment setup")) {
          setError("Payment setup was not completed. Please go back and complete your payment information.");
          setTimeout(() => {
            router.push(`/onboarding/setup?leadId=${leadId}`);
          }, 3000);
          return;
        }

        if (errorData.error?.toLowerCase().includes("already been onboarded")) {
          // Treat this as a "soft success": show the completion UI (app download + optional password)
          // instead of the error screen or redirecting to /dashboard (which may bounce to /signin).
          setNotice(
            "Looks like this account is already set up. You can download the app below, or request a sign-in link from the web sign-in page.",
          );
          setIsLoading(false);
          return;
        }

        throw new Error(errorData.error || "Failed to complete onboarding");
      }

      console.log("[ONBOARDING] POST request successful, parsing response...");
      const data = await response.json();
      console.log("[ONBOARDING] Response data:", data);
      
      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        console.log("[ONBOARDING] Component unmounted, skipping state update");
        return;
      }
      
      setSubscriptionData(data);
      console.log("[ONBOARDING] subscriptionData set");

      const normalizedAuthMethod =
        authMethod === "password" ? "password" : "magic";

      const responseEmail =
        (data?.customerEmail as string | undefined) ??
        (data?.customer_email as string | undefined) ??
        (data?.email as string | undefined) ??
        null;

      const resolvedEmail = storedLeadEmail || responseEmail;

      const signedIn =
        normalizedAuthMethod === "password"
          ? await performPasswordSignIn({ email: resolvedEmail, password })
          : false;

      try {
        sessionStorage.removeItem("setupIntentId");
        sessionStorage.removeItem("paymentMethodId");
        sessionStorage.removeItem("todaysChargeCents");
        sessionStorage.removeItem("billingPreference");
        sessionStorage.removeItem("selectedServiceDate");
        sessionStorage.removeItem("selectedServiceWindow");
        sessionStorage.removeItem("authMethod");
        sessionStorage.removeItem("userPassword");
        sessionStorage.removeItem("dogDoor");
        sessionStorage.removeItem("dogsOutside");
        sessionStorage.removeItem("cleanWithDogs");
        sessionStorage.removeItem("gateLocation");
        sessionStorage.removeItem("gateLocationNotes");
        sessionStorage.removeItem("trashLocation");
        sessionStorage.removeItem("trashLocationNotes");
        sessionStorage.removeItem("communityGateAccess");
        sessionStorage.removeItem("communityGateCode");
        sessionStorage.removeItem("homeGateAccess");
        sessionStorage.removeItem("homeGateCode");
        sessionStorage.removeItem("accessNotes");
        sessionStorage.removeItem("leadEmail");
      } catch (storageError) {
        console.warn("Unable to clear onboarding session data", storageError);
      }

      if (!signedIn && isMountedRef.current) {
        setIsLoading(false);
      }
    } catch (err) {
      console.error("[ONBOARDING] Onboarding completion error:", err);
      if (isMountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : "There was an issue completing your setup. Please contact support.";
        setError(errorMessage);
      }
    } finally {
      console.log("[ONBOARDING] Setting isLoading to false");
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  const handleCreatePassword = async () => {
    setPasswordError("");
    
    if (!newPassword) {
      setPasswordError("Please enter a password");
      return;
    }
    
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    if (!subscriptionData?.customerId) {
      setPasswordError("Unable to create password. Please try again later.");
      return;
    }

    setIsCreatingPassword(true);
    
    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: subscriptionData.customerId,
          password: newPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || "Failed to create password");
      }

      setPasswordSuccess(true);
      setNewPassword("");
      setConfirmNewPassword("");
      
      // Try to sign in with the new password
      const storedEmail = sessionStorage.getItem("leadEmail");
      if (storedEmail) {
        const signInResult = await signIn("credentials", {
          email: storedEmail,
          password: newPassword,
          redirect: false,
        });
        
        if (signInResult?.ok) {
          router.replace("/dashboard");
        }
      }
    } catch (err) {
      console.error("Password creation error:", err);
      setPasswordError(err instanceof Error ? err.message : "Failed to create password. Please try again.");
    } finally {
      setIsCreatingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-coral" />
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Completing your setup...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-brand-coral" />
            <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">Setup Incomplete</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">{error}</p>
            <div className="space-y-3 text-sm">
              <Button
                onClick={() => window.location.reload()}
                className="w-full rounded-xl bg-brand-coral text-white hover:bg-brand-coral-ink"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                asChild
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Link href="/contact">Contact Support</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="mx-auto w-full max-w-5xl px-5 pt-20 pb-16 md:px-6 md:pt-28 md:pb-20">
        <div className="space-y-10">
          {/* Success Header */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg space-y-5 md:text-left md:px-10 md:py-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 md:mx-0 md:h-20 md:w-20">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400 md:h-10 md:w-10" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-white md:text-4xl">Welcome to InsightScoop!</h1>
              <p className="text-base text-slate-600 dark:text-slate-300">
                Your account is ready and your first visit is on the calendar.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {signInError
                  ? "You're all set! Use the options below to hop into your dashboard."
                  : "Hang tight—if you aren't redirected automatically, you can jump into your dashboard below."}
              </p>
            </div>
          </section>

          {signInError && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertCircle className="mt-0.5 h-4 w-4" />
              <span>{signInError}</span>
            </div>
          )}

          {notice && (
            <div className="flex items-start gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-5 py-3 text-sm text-slate-700 dark:text-slate-200">
              <AlertCircle className="mt-0.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>{notice}</span>
            </div>
          )}

          {subscriptionData && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* First Visit Card */}
              <Card className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                <CardHeader className="space-y-1 border-b border-slate-200 dark:border-slate-700 pb-4">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <Calendar className="h-5 w-5 text-brand-coral" />
                    Your First Visit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-coral/10 dark:bg-brand-coral/20">
                      <Calendar className="h-6 w-6 text-brand-coral" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{firstVisitDateDisplay}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{firstVisitTimeDisplay}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-coral/10 dark:bg-brand-coral/20">
                      <MapPin className="h-6 w-6 text-brand-coral" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">Service Address</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{subscriptionData.serviceAddress}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm">
                    <h4 className="font-semibold text-emerald-900 dark:text-emerald-300">What to expect</h4>
                    <ul className="mt-2 space-y-1 text-emerald-700 dark:text-emerald-400">
                      <li>• Professional, uniformed technician</li>
                      <li>• Eco-friendly cleanup and diversion</li>
                      <li>• Visit photos and wellness snapshots</li>
                      <li>• Environmental impact tracking</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Account Card */}
              <Card className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
                <CardHeader className="space-y-1 border-b border-slate-200 dark:border-slate-700 pb-4">
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <CheckCircle className="h-5 w-5 text-brand-coral" />
                    Your Account
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Subscription</span>
                      <Badge variant="outline" className="rounded-full border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        Active
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Next billing</span>
                      <span className="font-medium text-slate-900 dark:text-white">{nextBillingDateDisplay}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Customer ID</span>
                      <span className="rounded-lg bg-slate-100 dark:bg-slate-700 px-2 py-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                        {subscriptionData.customerId.slice(-8)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-4 text-sm">
                    <h4 className="font-semibold text-slate-900 dark:text-white">Dashboard highlights</h4>
                    <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                      <li>• Manage schedule & payment methods</li>
                      <li>• Review visit photos and insights</li>
                      <li>• Track eco impact and diversion stats</li>
                      <li>• Update yard access preferences anytime</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Get the App - Primary CTA */}
          <section className="rounded-3xl border-2 border-brand-coral/30 bg-gradient-to-br from-brand-coral/5 to-emerald-50/50 dark:from-brand-coral/10 dark:to-emerald-900/20 p-8 shadow-lg space-y-6">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-coral/15 dark:bg-brand-coral/25">
                <Smartphone className="h-8 w-8 text-brand-coral" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
                Get the InsightScoop App
              </h3>
              <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                Track visits, view photos, manage your schedule, and get real-time notifications—all from your phone.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://apps.apple.com/app/insightscoop"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-5 py-3 text-white dark:text-slate-900 font-medium transition-all hover:bg-slate-800 dark:hover:bg-slate-100 hover:scale-105"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <div className="text-left">
                  <div className="text-[10px] opacity-80 leading-none">Download on the</div>
                  <div className="text-sm font-semibold leading-tight">App Store</div>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.insightscoop"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-5 py-3 text-white dark:text-slate-900 font-medium transition-all hover:bg-slate-800 dark:hover:bg-slate-100 hover:scale-105"
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                <div className="text-left">
                  <div className="text-[10px] opacity-80 leading-none">Get it on</div>
                  <div className="text-sm font-semibold leading-tight">Google Play</div>
                </div>
              </a>
            </div>

            <div className="grid gap-4 md:grid-cols-3 pt-4 border-t border-slate-200/50 dark:border-slate-600/30">
              {[
                { icon: "📸", title: "Visit Photos", body: "See before & after photos from every visit" },
                { icon: "🔔", title: "Real-time Alerts", body: "Get notified when your scooper arrives" },
                { icon: "📅", title: "Easy Scheduling", body: "Pause, reschedule, or add visits instantly" },
              ].map((item) => (
                <div key={item.title} className="text-center">
                  <span className="text-2xl">{item.icon}</span>
                  <h4 className="font-semibold text-slate-900 dark:text-white mt-2">{item.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Optional Password Creation */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg">
            <button
              type="button"
              onClick={() => setShowPasswordSection((prev) => !prev)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700">
                  <Lock className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                </div>
                <div className="text-left">
                  <h4 className="font-semibold text-slate-900 dark:text-white">Create a web password</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Optional—access your account from any browser</p>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-slate-400 transition-transform",
                  showPasswordSection && "rotate-180"
                )}
              />
            </button>

            {showPasswordSection && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
                {passwordSuccess ? (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4 text-center">
                    <CheckCircle className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    <p className="mt-2 font-semibold text-emerald-900 dark:text-emerald-300">Password created!</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">You can now sign in with your email and password.</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 p-3 text-sm text-slate-600 dark:text-slate-300">
                      We send secure magic links by default—no password needed. Create one here if you&apos;d prefer to sign in with a password.
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="newPassword" className="text-sm font-medium text-slate-900 dark:text-white">
                          Password
                        </Label>
                        <div className="relative mt-1">
                        <Input
                          id="newPassword"
                            type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Create a secure password"
                            className="rounded-xl pr-12"
                          disabled={isCreatingPassword}
                        />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                          >
                            {showNewPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Minimum 8 characters</p>
                      </div>
                      
                      <div>
                        <Label htmlFor="confirmNewPassword" className="text-sm font-medium text-slate-900 dark:text-white">
                          Confirm Password
                        </Label>
                        <div className="relative mt-1">
                        <Input
                          id="confirmNewPassword"
                            type={showConfirmNewPassword ? "text" : "password"}
                          value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)}
                          placeholder="Confirm your password"
                            className="rounded-xl pr-12"
                          disabled={isCreatingPassword}
                        />
                          <button
                            type="button"
                            onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                            aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmNewPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {passwordError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                    )}

                    <Button
                      onClick={handleCreatePassword}
                      disabled={isCreatingPassword || !newPassword || !confirmNewPassword}
                      className="w-full rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
                    >
                      {isCreatingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating password...
                        </>
                      ) : (
                        "Create password"
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </section>

          {/* Wellness Options */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-serif font-semibold text-slate-900 dark:text-white">
                Wellness options for your pups
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Choose free, premium, or pro-assisted wellness support.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Start Free</p>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <li>• 1-tap stool captures</li>
                  <li>• Daily check-ins + reminders</li>
                  <li>• Stool library + food log</li>
                </ul>
                <Button
                  asChild
                  size="sm"
                  className="w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  <Link href="/mobile/dashboard/wellness/capture">Start Free</Link>
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Premium Wellness</p>
                  <span className="text-xs text-slate-500 dark:text-slate-400">$19.99/mo</span>
                </div>
                <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <li>• Unlimited scans + chat</li>
                  <li>• Multi-dog tracking</li>
                  <li>• Long-term trends + risk score</li>
                </ul>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full rounded-xl border-slate-300 dark:border-slate-600"
                >
                  <Link href="/mobile/dashboard/billing">Upgrade</Link>
                </Button>
              </div>

              <div className="rounded-2xl border border-emerald-300/50 dark:border-emerald-400/40 bg-emerald-50/70 dark:bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Scooping + Pro Wellness
                  </p>
                  <span className="text-xs text-emerald-700 dark:text-emerald-200">Included</span>
                </div>
                <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <li>• Auto-captures by pros</li>
                  <li>• Consistent schedules = better data</li>
                  <li>• Vet-ready timeline</li>
                </ul>
                <Button
                  asChild
                  size="sm"
                  className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Link href="/mobile/dashboard/wellness">View wellness</Link>
                </Button>
              </div>
            </div>
          </section>

          {/* What Happens Next */}
          <section className="rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg space-y-6">
            <h3 className="text-xl font-serif font-semibold text-slate-900 dark:text-white text-center">
              What happens next
            </h3>
            <div className="grid gap-6 md:grid-cols-3">
              {[{
                icon: "📧",
                title: "Confirmation email",
                body: "Includes your visit details and account summary",
              },
              {
                icon: "📱",
                title: "Text updates",
                body: "Receive SMS reminders before and after each visit",
              },
              {
                icon: "🐕",
                title: "First visit",
                body: "Our scooper will arrive and work their magic!",
              }].map((item) => (
                <div key={item.title} className="text-center md:text-left">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-coral/10 dark:bg-brand-coral/20 text-lg md:mx-0">
                    <span>{item.icon}</span>
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white">{item.title}</h4>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{item.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Secondary Action Buttons */}
          <div className="space-y-4 text-center">
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="w-full rounded-xl bg-brand-coral text-white hover:bg-brand-coral-ink sm:w-auto"
              >
                <Link href="/dashboard">
                  Go to web dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 sm:w-auto"
              >
                <Link href="/">Back to home</Link>
              </Button>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Questions? Call us at{" "}
              <a href="tel:1-877-417-9273" className="font-semibold text-brand-coral hover:text-brand-coral-ink">
                1-877-417-YARD (9273)
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          <div className="flex min-h-screen items-center justify-center px-6">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-coral" />
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <OnboardingCompleteContent />
    </Suspense>
  );
}
