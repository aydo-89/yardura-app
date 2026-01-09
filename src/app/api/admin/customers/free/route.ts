import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/customers/free
 * Returns all customers who don't have an active scooping service (free pet owners)
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only allow admins
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("OWNER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get all customers who don't have any ACTIVE jobs
    const freeCustomers = await prisma.customer.findMany({
      where: {
        // No active jobs
        jobs: {
          none: {
            status: "ACTIVE",
          },
        },
      },
      select: {
        id: true,
        orgId: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
          },
        },
        dogs: {
          select: {
            id: true,
            name: true,
            breed: true,
          },
        },
        _count: {
          select: {
            dogs: true,
            wellnessCaptures: true,
            wellnessReminders: true,
            wellnessWalks: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get usage stats for each customer
    const currentPeriodKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    
    const usageStats = await prisma.customerWellnessUsage.findMany({
      where: {
        customerId: { in: freeCustomers.map((c) => c.id) },
        periodKey: currentPeriodKey,
      },
      select: {
        customerId: true,
        scansCount: true,
        chatsCount: true,
        foodScansCount: true,
      },
    });

    const usageMap = new Map(usageStats.map((u) => [u.customerId, u]));

    const enrichedCustomers = freeCustomers.map((customer) => {
      const usage = usageMap.get(customer.id);
      return {
        ...customer,
        usage: {
          scansThisMonth: usage?.scansCount ?? 0,
          chatsThisMonth: usage?.chatsCount ?? 0,
          foodScansThisMonth: usage?.foodScansCount ?? 0,
        },
      };
    });

    return NextResponse.json({
      customers: enrichedCustomers,
      total: enrichedCustomers.length,
    });
  } catch (error) {
    console.error("[admin/customers/free] Error fetching free pet owners:", error);
    return NextResponse.json(
      { error: "Failed to fetch free pet owners" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";

