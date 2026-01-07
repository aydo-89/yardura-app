"use client";

import { useState, useEffect, useMemo } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = searchParams ?? new URLSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const initialMethod = useMemo(
    () => (params.get("method") === "magic" ? "magic" : "password"),
    [params],
  );
  const [authMethod, setAuthMethod] = useState<"magic" | "password">(initialMethod);

  // Pre-fill email if provided in URL
  useEffect(() => {
    const emailParam = params.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }

  }, [searchParams]);

  useEffect(() => {
    setAuthMethod(initialMethod);
  }, [initialMethod]);

  useEffect(() => {
    setError("");
    setIsLoading(false);
    if (authMethod === "password") {
      setMagicLinkSent(false);
    }
  }, [authMethod]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // First, check if the email exists
      const checkResponse = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const checkResult = await checkResponse.json();

      if (!checkResult.exists) {
        setError(
          "We couldn't find an account with that email. Please check your email or contact support if you need access."
        );
        setIsLoading(false);
        return;
      }

      // If email exists, proceed with magic link
      const result = await signIn("email", {
        email: normalizedEmail,
        redirect: false,
        callbackUrl,
      });

    if (result?.error) {
      setError("Failed to send magic link. Please try again.");
    } else {
      setMagicLinkSent(true);
    }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      // For test user, don't require password
      const signInData: any = {
        email: normalizedEmail,
        redirect: false,
      };

      if (normalizedEmail !== "test@example.com") {
        signInData.password = password;
      }

      console.log("[SignInForm] Calling signIn with:", { email: normalizedEmail, redirect: false });
      const result = await signIn("credentials", signInData);
      console.log("[SignInForm] signIn result:", result);

      if (result?.error) {
        console.log("[SignInForm] Sign in error:", result.error);
        setError("Invalid email or password");
      } else {
        // Get updated session to check user role
        console.log("[SignInForm] Fetching session from /api/auth/session");
        const response = await fetch("/api/auth/session");
        const session = await response.json();
        console.log("[SignInForm] Session response:", session);

        // Redirect based on user role
        if (session?.userRole === "SALES_REP") {
          console.log("[SignInForm] Redirecting to /sales-rep/dashboard");
          router.push("/sales-rep/dashboard");
        } else if (session?.isAdmin) {
          console.log("[SignInForm] Redirecting to /admin");
          router.push("/admin");
        } else {
          console.log("[SignInForm] Redirecting to callbackUrl:", callbackUrl);
          router.push(callbackUrl);
        }
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (magicLinkSent && authMethod === "magic") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-coral/15 text-brand-coral dark:bg-brand-coral/20 dark:text-brand-coral">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-serif text-lg font-semibold text-brand-ink dark:text-cream-vanilla">Check your email</h3>
        <p className="text-brand-muted dark:text-cream-vanilla/80">
          We&apos;ve sent a sign-in link to <strong className="text-brand-ink dark:text-cream-vanilla">{email}</strong>
        </p>
        <p className="text-sm text-brand-muted dark:text-cream-vanilla/70">
          Click the link in your email to sign in to your account.
        </p>
        <Button
          variant="outline"
          onClick={() => setMagicLinkSent(false)}
          className="mt-4 rounded-2xl border-brand-coral/30 text-brand-ink hover:border-brand-coral/50 hover:bg-brand-coral/10 dark:border-brand-coral/40 dark:text-cream-vanilla dark:hover:bg-brand-coral/15"
        >
          Use a different email
        </Button>
      </div>
    );
  }

  // Shared input class for consistency
  const inputClassName = "h-12 rounded-2xl border border-brand-coral/20 bg-white text-brand-ink placeholder:text-brand-muted shadow-sm transition-all focus-visible:border-brand-coral/40 focus-visible:ring-2 focus-visible:ring-brand-coral/20 focus-visible:ring-offset-0 dark:border-white/20 dark:bg-evergreen-800 dark:text-cream-vanilla dark:placeholder:text-cream-vanilla/60 dark:focus-visible:border-brand-coral/60 dark:focus-visible:ring-brand-coral/40";

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive" className="rounded-2xl border-rose-300/50 bg-rose-50/90 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-300">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold text-brand-ink dark:text-cream-vanilla">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
          className={inputClassName}
        />
      </div>

      {authMethod === "password" ? (
        <form onSubmit={handlePasswordSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-semibold text-brand-ink dark:text-cream-vanilla">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required={email.trim().toLowerCase() !== "test@example.com"}
                placeholder="••••••••"
                className={`${inputClassName} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-ink dark:text-cream-vanilla/50 dark:hover:text-cream-vanilla transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
          </div>

          <Button 
            type="submit" 
            className="h-12 w-full rounded-2xl bg-brand-coral text-white shadow-[0_8px_20px_rgba(243,100,91,0.25)] transition-all hover:bg-brand-coral-ink hover:shadow-[0_12px_28px_rgba(243,100,91,0.3)] disabled:opacity-60" 
            disabled={isLoading}
          >
            {isLoading
              ? "Signing in..."
              : email.trim().toLowerCase() === "test@example.com"
                ? "Sign in (test user)"
                : "Sign in"}
          </Button>

          <div className="text-center">
            <a
              href="/forgot-password"
              className="text-sm text-brand-coral transition-colors hover:text-brand-coral-ink hover:underline dark:text-brand-coral dark:hover:text-brand-coral/80"
            >
              Forgot your password?
            </a>
          </div>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-3 rounded-2xl border border-brand-coral/12 bg-brand-coral/[0.03] p-4 dark:border-white/15 dark:bg-white/[0.04]">
          <Button
            type="submit"
            className="h-12 w-full rounded-2xl border border-brand-coral bg-brand-coral/10 text-brand-coral transition-all hover:bg-brand-coral/20 disabled:opacity-60 dark:border-brand-coral/60 dark:bg-brand-coral/15 dark:text-cream-vanilla dark:hover:bg-brand-coral/25"
            disabled={isLoading || !email}
          >
            {isLoading ? "Sending magic link..." : "Email me a magic link"}
          </Button>
          <p className="text-center text-xs text-brand-muted dark:text-cream-vanilla/70">
            We'll email a one-tap link — no password needed.
          </p>
        </form>
      )}

      <div className="rounded-2xl border border-brand-coral/12 bg-brand-coral/[0.03] px-4 py-3 text-center text-sm text-brand-muted dark:border-brand-coral/20 dark:bg-brand-coral/[0.06] dark:text-cream-vanilla/70">
        {authMethod === "password" ? (
          <button
            type="button"
            onClick={() => setAuthMethod("magic")}
            className="font-semibold text-brand-ink underline-offset-4 hover:underline dark:text-cream-vanilla"
          >
            Prefer a magic link instead?
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setAuthMethod("password")}
            className="font-semibold text-brand-ink underline-offset-4 hover:underline dark:text-cream-vanilla"
          >
            Use password instead
          </button>
        )}
      </div>
    </div>
  );
}
