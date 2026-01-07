"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { getProviders, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import SignInForm from "@/components/auth/SignInForm";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/ThemeProvider";

const GoogleIcon = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    xmlns="http://www.w3.org/2000/svg"
    className="mr-2"
  >
    <path
      d="M17.64 9.2045c0-.6395-.0573-1.2527-.1636-1.8364H9v3.475h4.8436c-.2086 1.125-.8427 2.0786-1.7959 2.7163v2.2582h2.9081c1.7027-1.5678 2.6836-3.874 2.6836-6.6131z"
      fill="#4285F4"
    />
    <path
      d="M9 18c2.43 0 4.4673-.8068 5.9563-2.1827l-2.9081-2.2582c-.8068.54-1.8377.8591-3.0482.8591-2.3441 0-4.3286-1.5859-5.035-3.7332H.957v2.3478C2.4382 15.9832 5.4818 18 9 18z"
      fill="#34A853"
    />
    <path
      d="M3.965 10.685C3.7786 10.145 3.6709 9.57 3.6709 9s.1077-1.145.2941-1.685V4.9673H.957C.3473 6.1845 0 7.5505 0 9s.3473 2.8155.957 4.0327L3.965 10.685z"
      fill="#FBBC04"
    />
    <path
      d="M9 3.5795c1.3214 0 2.5077.4545 3.4405 1.3464l2.5805-2.5804C13.4632.8641 11.4268 0 9 0 5.4818 0 2.4382 2.0168.957 4.9673L3.965 7.315c.7064-2.1473 2.6909-3.7355 5.035-3.7355z"
      fill="#EA4335"
    />
  </svg>
);

function SignInFormWrapper() {
  return <SignInForm />;
}

function SignInContent() {
  const [providers, setProviders] = useState<any>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = useMemo(() => searchParams?.get("callbackUrl") ?? "/dashboard", [searchParams]);
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    const loadProviders = async () => {
      const prov = await getProviders();
      setProviders(prov);
    };
    loadProviders();
  }, []);

  const providersLoaded = providers !== null;
  const googleProvider = providers?.google;

  const handleGoogleSignIn = useCallback(async () => {
    if (!googleProvider) {
      setOauthError("Google sign-in isn’t available right now. Please use your email instead.");
      return;
    }

    setOauthError(null);
    setIsGoogleLoading(true);

    try {
      const result = await signIn("google", {
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        setOauthError("We couldn’t reach Google right now. Please try again in a moment.");
        setIsGoogleLoading(false);
        return;
      }

      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      console.error("google-signin", error);
      setOauthError("Something went wrong connecting to Google. Please try again.");
      setIsGoogleLoading(false);
    }
  }, [callbackUrl, googleProvider]);

  return (
    <section className="relative isolate min-h-screen overflow-hidden text-slate-900 dark:text-slate-100">
      {/* Full-page hero background - Light Mode */}
      <div className="absolute inset-0 dark:hidden">
        <Image
          src="/hero_backgrounds/shepherd_orange_right_light.jpeg"
          alt="German shepherd in a sunny yard"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-white/70 to-white/50" />
      </div>
      {/* Full-page hero background - Dark Mode */}
      <div className="absolute inset-0 hidden dark:block">
        <Image
          src="/hero_backgrounds/shepherd_orange_right_dark.jpeg"
          alt="German shepherd in a cozy evening yard"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-900/70" />
      </div>
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/60 to-transparent dark:from-slate-950/80" aria-hidden="true" />

      <div className="absolute inset-x-0 top-0 z-10">
        <div className="container mx-auto flex max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-brand-coral/15 bg-cream-porcelain/90 px-3 py-2 text-sm font-semibold text-brand-ink shadow-sm transition hover:border-brand-coral/40 hover:bg-brand-coral/10 dark:border-brand-coral/30 dark:bg-evergreen-900/80 dark:text-cream-vanilla dark:hover:border-brand-coral/50 dark:hover:bg-brand-coral/20"
          >
            <span>← Back to homepage</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-coral/20 bg-cream-porcelain/90 text-brand-ink shadow-sm transition hover:border-brand-coral/40 hover:bg-brand-coral/10 dark:border-brand-coral/30 dark:bg-evergreen-900/70 dark:text-cream-vanilla dark:hover:border-brand-coral/50 dark:hover:bg-brand-coral/20"
              aria-label="Toggle color theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href="/quote"
              className="hidden items-center gap-2 rounded-full bg-brand-coral px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(243,100,91,0.3)] transition hover:bg-brand-coral-ink hover:shadow-[0_12px_28px_rgba(243,100,91,0.35)] lg:inline-flex"
            >
              Get a quote
            </Link>
          </div>
        </div>
      </div>

      <div className="container relative z-[5] mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-8 px-6 py-24 lg:px-8">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-brand-soft/80 bg-cream-porcelain p-8 shadow-[0_32px_80px_rgba(27,30,35,0.08)] dark:border-white/15 dark:bg-evergreen-900 dark:ring-1 dark:ring-white/5 dark:shadow-[0_32px_80px_rgba(0,0,0,0.4)] lg:max-w-lg">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Image
              src="/brand/insightscoop-logo-stacked.png"
              alt="InsightScoop logo"
              width={140}
              height={80}
              className="h-16 w-auto drop-shadow-sm"
              priority
            />
          </div>
          <h1 className="mb-2 font-serif text-3xl font-semibold text-brand-ink dark:text-cream-vanilla">Sign in</h1>
          <p className="mb-6 text-sm text-brand-muted dark:text-cream-vanilla/80">
            Use your email and password, or choose an approved provider.
          </p>

          <div className="mb-6 grid gap-3">
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={!googleProvider || isGoogleLoading}
              variant="outline"
              className="h-12 w-full justify-center rounded-2xl border border-brand-coral/20 bg-white px-4 text-sm font-semibold text-brand-ink shadow-sm transition-all hover:border-brand-coral/40 hover:bg-brand-coral/5 disabled:opacity-60 dark:border-brand-coral/30 dark:bg-evergreen-800 dark:text-cream-vanilla dark:hover:border-brand-coral/50 dark:hover:bg-brand-coral/15"
            >
              <GoogleIcon />
              {isGoogleLoading ? "Redirecting to Google…" : "Continue with Google"}
            </Button>
            {oauthError ? (
              <p className="text-center text-xs text-rose-600 dark:text-rose-400">{oauthError}</p>
            ) : null}
            {providersLoaded && !googleProvider && !oauthError ? (
              <p className="text-center text-xs text-brand-muted dark:text-cream-vanilla/70">
                Google sign-in is currently unavailable. Please use your email below.
              </p>
            ) : null}
          </div>

          <div className="relative mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-brand-soft dark:bg-brand-coral/20" />
            <span className="text-xs font-medium uppercase tracking-wider text-brand-muted dark:text-cream-vanilla/60">or</span>
            <div className="h-px flex-1 bg-brand-soft dark:bg-brand-coral/20" />
          </div>

          <Suspense fallback={<div className="flex h-48 items-center justify-center text-sm text-brand-muted">Loading...</div>}>
            <SignInFormWrapper />
          </Suspense>

          <p className="mt-6 text-center text-xs text-brand-muted dark:text-cream-vanilla/60">
            Protected by Google reCAPTCHA and served over HTTPS.
          </p>
        </div>

        {/* Testimonial card floating below */}
        <div className="mx-auto w-full max-w-md rounded-2xl border border-white/15 bg-evergreen-900/70 p-5 shadow-xl backdrop-blur-sm dark:border-white/10 dark:bg-black/40 lg:max-w-lg">
          <p className="text-sm font-semibold text-cream-vanilla drop-shadow-sm">
            "InsightScoop keeps our yard sparkling—even with two energetic pups."
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-cream-vanilla/70">
            Maple Grove • Weekly Member
          </p>
        </div>
      </div>
    </section>
  );
}

export default function SignInClient() {
  return (
    <Suspense fallback={<div className="container py-16"><div className="mx-auto max-w-md">Loading...</div></div>}>
      <SignInContent />
    </Suspense>
  );
}
