"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // For test user, don't require password
      const signInData: any = {
        email,
        redirect: false,
      };

      if (email.toLowerCase() !== "test@example.com") {
        signInData.password = password;
      }

      const result = await signIn("credentials", signInData);

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        // Get updated session to check user role
        const response = await fetch("/api/auth/session");
        const session = await response.json();

        // Redirect based on user role
        if (session?.userRole === "SALES_REP") {
          router.push("/sales-rep/dashboard");
        } else if (session?.isAdmin) {
          router.push("/admin");
        } else {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      {email.toLowerCase() !== "test@example.com" && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required={email.toLowerCase() !== "test@example.com"}
          />
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading
          ? "Signing in..."
          : email.toLowerCase() === "test@example.com"
            ? "Sign in (Test User)"
            : "Sign in with Password"}
      </Button>

      <div className="text-center mt-4">
        <a
          href="/forgot-password"
          className="text-sm text-brand-600 hover:text-brand-700 hover:underline"
        >
          Forgot your password?
        </a>
      </div>
    </form>
  );
}
