"use client";

import { ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import UserHeader from "@/components/site/UserHeader";

interface UserLayoutProps {
  children: ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export default function UserLayout({
  children,
  requireAuth = true,
  redirectTo = "/signin",
}: UserLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    console.log("[UserLayout] Session status:", status, "Session:", !!session?.user);
    
    // Wait for session to fully load
    if (status === "loading") {
      console.log("[UserLayout] Still loading, waiting...");
      return;
    }

    // Only redirect if we're SURE there's no session (not authenticated after loading)
    if (requireAuth && status === "unauthenticated") {
      console.log("[UserLayout] Unauthenticated, redirecting to signin");
      router.push(
        `${redirectTo}?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
    } else {
      console.log("[UserLayout] Authenticated, staying on page");
    }
  }, [session, status, requireAuth, redirectTo, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse bg-slate-200 h-8 w-48 rounded mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-300">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <main className="flex-1">{children}</main>
    </div>
  );
}
