"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

function MobileSignInContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const callbackUrl = useMemo(
    () => searchParams?.get("callbackUrl") ?? "/mobile/dashboard",
    [searchParams],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      try {
        const result = await signIn("credentials", {
          email: email.trim().toLowerCase(),
          password,
          callbackUrl,
          redirect: false,
        });

        if (result?.error) {
          setError("Invalid email or password");
          setIsLoading(false);
          return;
        }

        if (result?.ok) {
          router.push(callbackUrl);
        }
      } catch (err) {
        console.error("signin-error", err);
        setError("Something went wrong. Please try again.");
        setIsLoading(false);
      }
    },
    [email, password, callbackUrl, router],
  );

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="px-6 py-8 text-center">
        <Image
          src="/brand/insightscoop-logo-stacked.png"
          alt="InsightScoop"
          width={120}
          height={68}
          className="mx-auto h-16 w-auto drop-shadow-lg"
          priority
        />
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Welcome Text */}
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold text-white">Welcome back</h1>
            <p className="text-sm text-slate-400">
              Sign in to access your dashboard
            </p>
          </div>

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-200">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isLoading}
                className="h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-brand-mint focus:ring-brand-mint"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-200">
                Password
              </Label>
              <div className="relative">
              <Input
                id="password"
                  type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                  className="h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-brand-mint focus:ring-brand-mint pr-12"
              />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full bg-brand-mint text-slate-900 font-semibold hover:bg-brand-mint/90 disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Forgot Password Link */}
          <div className="text-center">
            <a
              href="/forgot-password"
              className="text-sm text-brand-mint hover:text-brand-mint/80 transition-colors"
            >
              Forgot your password?
            </a>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-900 px-2 text-slate-500">
                Need an account?
              </span>
            </div>
          </div>

          {/* Sign Up Link */}
          <div className="text-center">
            <a
              href="/quote"
              className="text-sm font-medium text-white hover:text-brand-mint transition-colors"
            >
              Get started with a free quote →
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-slate-500">
          Protected by industry-standard encryption
        </p>
      </footer>
    </div>
  );
}

export default function MobileSignInPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <MobileSignInContent />
    </Suspense>
  );
}









