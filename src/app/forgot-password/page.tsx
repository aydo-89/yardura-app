"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        setError(data.error || "Failed to send reset email");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
              Check your email
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              We've sent a password reset link to{" "}
              <strong className="text-slate-900 dark:text-white">{email}</strong>
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-brand-coral mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    Didn't receive the email?
                  </p>
                  <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <li>• Check your spam/junk folder</li>
                    <li>• The link expires in 24 hours</li>
                    <li>• Make sure you entered the correct email</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                onClick={() => router.push("/signin")}
                className="w-full rounded-xl border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                variant="outline"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>

              <Button
                onClick={() => setIsSuccess(false)}
                variant="ghost"
                className="w-full text-sm rounded-xl"
              >
                Try a different email
              </Button>
            </div>
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
              <Mail className="h-6 w-6 text-slate-700 dark:text-slate-200" />
            </div>
            <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white">
              Reset your password
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700 dark:text-slate-200">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={isLoading}
                className="rounded-xl"
              />
            </div>

            <Button
              type="submit"
              className="w-full rounded-xl bg-brand-coral text-white hover:bg-brand-coral-ink"
              disabled={isLoading}
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="text-center mt-6">
            <Link
              href="/signin"
              className="text-sm text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
