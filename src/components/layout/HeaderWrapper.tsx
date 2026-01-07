"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import AnimatedHeader from "@/components/site/AnimatedHeader";
import UserHeader from "@/components/site/UserHeader";
import { QuoteWizardHeader } from "@/components/quote/QuoteWizardHeader";

export default function HeaderWrapper() {
  const { data: session, status } = useSession();
  const pathname = usePathname() ?? "/";

  // Don't show header on these pages
  const noHeaderPages = ["/signin", "/signup", "/api"];
  if (noHeaderPages.some((page) => pathname.startsWith(page))) {
    return null;
  }

  // Hide the header for dedicated mobile routes
  if (pathname.startsWith("/mobile")) {
    return null;
  }

  const isDashboardPage = pathname.startsWith("/dashboard");
  if (isDashboardPage) {
    return null;
  }

  // Show user header for authenticated users on protected pages
  const userPages = ["/dashboard", "/account"];
  const isUserPage = userPages.some((page) => pathname.startsWith(page));

  // Check if we're on admin pages (admin gets special header)
  const isAdminPage = pathname.startsWith("/admin");
  const isFieldOpsPage = pathname.startsWith("/field-tech");

  if (status === "loading") {
    // Keep placeholder fixed so content doesn't shift while session resolves
    return (
      <header className="fixed top-0 left-0 right-0 z-[1000] bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-center">
          <div className="animate-pulse bg-slate-200 h-8 w-32 rounded"></div>
        </div>
      </header>
    );
  }

  if (pathname.startsWith("/quote")) {
    return <QuoteWizardHeader />;
  }

  // Show user header for authenticated users on user pages or admin pages
  if (session?.user && (isUserPage || isAdminPage || isFieldOpsPage)) {
    return <UserHeader />;
  }

  // Show animated header for public pages and non-authenticated users
  return <AnimatedHeader />;
}
