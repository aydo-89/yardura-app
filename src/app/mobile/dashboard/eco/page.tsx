import { redirect } from "next/navigation";

import { safeGetServerSession, authOptions } from "@/lib/auth";
import {
  extractActiveRole,
  extractUserRoles,
  getDefaultRedirectForRole,
} from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import MobileEcoScreen from "@/components/dashboard/mobile/MobileEcoScreen";

export default async function MobileEcoPage() {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user?.email) {
    redirect("/signin?callbackUrl=/mobile/dashboard/eco");
  }

  const roles = extractUserRoles(session);
  const activeRole = extractActiveRole(session);
  const prioritizedRole = activeRole ?? roles[0] ?? null;

  const redirectForRole = (
    role: typeof prioritizedRole,
    options?: { requireCustomer?: boolean },
  ) => {
    if (!role) {
      return options?.requireCustomer ? "/quote" : "/dashboard";
    }
    if (role === "TECH") {
      return "/field-tech";
    }
    if (role === "CUSTOMER" && options?.requireCustomer) {
      return "/quote";
    }
    return getDefaultRedirectForRole(role);
  };

  if (activeRole && activeRole !== "CUSTOMER") {
    redirect(redirectForRole(activeRole));
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      dataReadings: {
        orderBy: { timestamp: "desc" },
        take: 200,
        select: {
          timestamp: true,
          weight: true,
        },
      },
    },
  });

  if (!user) {
    redirect(redirectForRole(prioritizedRole, { requireCustomer: true }));
  }

  const lead = await prisma.lead.findFirst({
    where: { email: session.user.email },
    orderBy: { submittedAt: "desc" },
    select: { divertMode: true },
  });
  const normalizedDivertMode = lead?.divertMode?.toLowerCase() ?? null;
  const hasComposting =
    normalizedDivertMode != null &&
    !["none", "takeaway"].includes(normalizedDivertMode);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let gramsThisMonth = 0;
  let totalGrams = 0;

  for (const reading of user.dataReadings) {
    const weight = reading.weight ?? 0;
    totalGrams += weight;
    const ts = reading.timestamp.getTime();
    if (ts >= monthStart.getTime() && ts < monthEnd.getTime()) {
      gramsThisMonth += weight;
    }
  }

  const methaneThisMonthFt3 = gramsThisMonth * 0.002 * 0.67;

  return (
    <div className="px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Eco impact</h1>
        <p className="text-sm text-slate-400">
          See how every visit cuts down waste and methane emissions.
        </p>
      </header>

      <MobileEcoScreen
        gramsThisMonth={gramsThisMonth}
        methaneThisMonthFt3={methaneThisMonthFt3}
        totalGrams={totalGrams}
        hasComposting={hasComposting}
      />
    </div>
  );
}
