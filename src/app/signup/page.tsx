"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function SignUpPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Only required fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white py-12">
      <div className="container max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-ink mb-4">
            Create Your Account
          </h1>
          <p className="text-slate-600">
            Get started with Yardura in just 30 seconds
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
              />
            </div>

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Confirm your password"
              />
            </div>

            <Button
              onClick={handleSignUp}
              disabled={loading}
              className="w-full"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center text-sm text-slate-600">
              Already have an account?{" "}
              <a href="/signin" className="text-accent hover:underline">
                Sign in
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
