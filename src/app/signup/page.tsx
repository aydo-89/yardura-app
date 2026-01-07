"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Only required fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSignUp = async () => {
    setLoading(true);

    // Validate passwords
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    try {
      // Create the user account using our custom API
      const createAccountResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: email.split("@")[0], // Use email prefix as name
        }),
      });

      if (!createAccountResponse.ok) {
        const errorData = await createAccountResponse.json();
        toast.error(errorData.error || "Error creating account");
        return;
      }

      await createAccountResponse.json();

      // Clear any existing quote data
      localStorage.removeItem("quoteFormData");
      localStorage.removeItem("quoteEstimate");

      toast.success("Account created successfully! Signing you in...");

      // Automatically sign in the user
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        toast.error(
          "Account created but sign in failed. Please try signing in manually.",
        );
        router.push("/signin");
      } else {
        toast.success("Welcome to Yardura!");
        router.push("/dashboard");
      }
    } catch {
      toast.error("Error creating account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#04110c] bg-gradient-to-b from-[#03130d] via-[#040f0b] to-[#020806] py-12 text-emerald-100 md:bg-gradient-to-b md:from-brand-50 md:via-white md:to-white md:text-ink">
      <div className="mx-auto w-full max-w-md px-6">
        <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200 md:border-transparent md:bg-transparent md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
            <span className="size-1.5 rounded-full bg-emerald-300" />
            Yardura onboarding
          </span>
          <h1 className="mt-5 text-3xl font-extrabold text-emerald-50 md:text-ink">
            Create Your Account
          </h1>
          <p className="mt-2 text-sm text-emerald-200/80 md:text-slate-600">
            Get started in under a minute and manage every visit from your phone.
          </p>
        </div>

        <Card className="rounded-3xl border border-emerald-500/20 bg-slate-950/70 shadow-[0_25px_80px_rgba(0,0,0,0.5)] backdrop-blur md:rounded-2xl md:border-transparent md:bg-white md:shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold text-emerald-50 md:text-ink">
              Sign Up
            </CardTitle>
            <p className="text-sm text-emerald-200/70 md:text-slate-500">
              Use the email you’ll want for scheduling updates.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@email.com"
                className="h-11 rounded-2xl border border-emerald-500/25 bg-slate-950/50 text-sm text-emerald-50 placeholder:text-emerald-200/40 focus-visible:ring-emerald-300/40 focus-visible:ring-offset-0 md:border-input md:bg-white md:text-ink md:placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                Password *
              </Label>
              <div className="relative">
              <Input
                id="password"
                  type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                  className="h-11 rounded-2xl border border-emerald-500/25 bg-slate-950/50 text-sm text-emerald-50 placeholder:text-emerald-200/40 focus-visible:ring-emerald-300/40 focus-visible:ring-offset-0 md:border-input md:bg-white md:text-ink md:placeholder:text-slate-400 pr-12"
              />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-200/50 hover:text-emerald-200 md:text-slate-400 md:hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200/80 md:text-[rgba(var(--graphite-rgb-commas),0.65)]">
                Confirm Password *
              </Label>
              <div className="relative">
              <Input
                id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Confirm your password"
                  className="h-11 rounded-2xl border border-emerald-500/25 bg-slate-950/50 text-sm text-emerald-50 placeholder:text-emerald-200/40 focus-visible:ring-emerald-300/40 focus-visible:ring-offset-0 md:border-input md:bg-white md:text-ink md:placeholder:text-slate-400 pr-12"
              />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-200/50 hover:text-emerald-200 md:text-slate-400 md:hover:text-slate-600 transition-colors"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            <Button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-400 text-slate-900 transition hover:bg-emerald-300 focus-visible:ring-emerald-200/60 md:rounded-lg md:bg-primary md:text-primary-foreground md:hover:bg-primary/90"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center text-xs text-emerald-200/70 md:text-slate-600">
              Already have an account?{" "}
              <a href="/signin" className="font-semibold text-emerald-200 hover:text-emerald-100 md:text-accent md:hover:underline">
                Sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
