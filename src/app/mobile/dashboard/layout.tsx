import type { ReactNode } from "react";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import MobileDashboardNav from "@/components/dashboard/mobile/MobileDashboardNav";
import MobileAppHeader from "@/components/dashboard/mobile/MobileAppHeader";

export const dynamic = "force-dynamic";

export default async function MobileDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await safeGetServerSession(authOptions as any);

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Safe area for status bar/notch */}
      <div className="h-[env(safe-area-inset-top)] bg-slate-950" />

      <MobileAppHeader />

      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      <MobileDashboardNav />
    </div>
  );
}
