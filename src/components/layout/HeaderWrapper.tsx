"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import AnimatedHeader from "@/components/site/AnimatedHeader";
import UserHeader from "@/components/site/UserHeader";

export default function HeaderWrapper() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // Don't show header on these pages
  const noHeaderPages = ["/signin", "/signup", "/api"];
  if (noHeaderPages.some((page) => pathname.startsWith(page))) {
    return null;
  }

  // Show user header for authenticated users on protected pages
  const userPages = ["/dashboard", "/account"];
  const isUserPage = userPages.some((page) => pathname.startsWith(page));

  // Check if we're on admin pages (admin gets special header)
  const isAdminPage = pathname.startsWith("/admin");

  if (status === "loading") {
    // Show loading state while session loads
    return (
      <header className="w-full bg-white/95 backdrop-blur-sm border-b border-slate-200/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-center">
          <div className="animate-pulse bg-slate-200 h-8 w-32 rounded"></div>
        </div>
      </header>
    );
  }

  // Show user header for authenticated users on user pages or admin pages
  if (session?.user && (isUserPage || isAdminPage)) {
    return <UserHeader />;
  }

  // Show animated header for public pages and non-authenticated users
  return <AnimatedHeader />;
}
