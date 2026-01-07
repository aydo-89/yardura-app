"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock, Loader2 } from "lucide-react";
import Link from "next/link";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = searchParams ?? new URLSearchParams();
  const token = params.get("token");

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
      setTokenValid(false);
      return;
    }

    // Validate the token
    validateToken(token);
  }, [token]);

  const validateToken = async (token: string) => {
    try {
      const response = await fetch("/api/auth/validate-reset-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        setTokenValid(true);
      } else {
        setError(
          "This reset link has expired or is invalid. Please request a new one.",
        );
        setTokenValid(false);
      }
    } catch {
      setError("Failed to validate reset link. Please try again.");
      setTokenValid(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        // Redirect to sign in after 3 seconds
        setTimeout(() => {
          router.push("/signin");
        }, 3000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/15">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white mb-2">
              Invalid Reset Link
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This password reset link is invalid or has expired.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => router.push("/forgot-password")}
              className="w-full rounded-xl bg-brand-coral text-white hover:bg-brand-coral-ink"
            >
              Request New Reset Link
            </Button>

            <Link
              href="/signin"
              className="block text-center text-sm text-slate-600 dark:text-slate-300 hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex min-h-screen items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center shadow-lg">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/15">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white mb-2">
              Password Reset Successful
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Your password has been successfully reset. You can now sign in
              with your new password.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => router.push("/signin")}
              className="w-full rounded-xl bg-brand-coral text-white hover:bg-brand-coral-ink"
            >
              Sign In Now
            </Button>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Redirecting to sign in page in 3 seconds...
            </p>
          </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-lg">
          <div className="text-center mb-6 space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-700">
              <Lock className="h-6 w-6 text-slate-700 dark:text-slate-200" />
            </div>
            <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
              Set a new password
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter your new password below.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {tokenValid === null && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-coral" />
              <span className="ml-3 text-sm text-slate-600 dark:text-slate-300">
                Validating reset link...
              </span>
            </div>
          )}

          {tokenValid === true && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-200">
                  New password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    disabled={isLoading}
                    minLength={8}
                    className="rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-700 dark:text-slate-200">
                  Confirm new password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    disabled={isLoading}
                    minLength={8}
                    className="rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p>Password requirements:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>At least 8 characters long</li>
                  <li>Both passwords must match</li>
                </ul>
              </div>

              <Button
                type="submit"
                className="w-full rounded-xl bg-brand-coral text-white hover:bg-brand-coral-ink"
                disabled={isLoading}
              >
                {isLoading ? "Resetting password..." : "Reset password"}
              </Button>
            </form>
          )}

          <div className="text-center mt-6">
            <Link
              href="/signin"
              className="text-sm text-slate-600 dark:text-slate-300 hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
          <div className="flex min-h-screen items-center justify-center px-6 py-12">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-lg">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-brand-coral" />
                <span className="ml-3 text-sm text-slate-600 dark:text-slate-300">
                  Loading...
                </span>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
