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
    if (status === "loading") return;

    if (requireAuth && !session?.user) {
      router.push(
        `${redirectTo}?callbackUrl=${encodeURIComponent(window.location.pathname)}`,
      );
    }
  }, [session, status, requireAuth, redirectTo, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (requireAuth && !session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse bg-slate-200 h-8 w-48 rounded mx-auto mb-4"></div>
          <p className="text-slate-600">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <main className="flex-1">{children}</main>
    </div>
  );
}
