import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeGetServerSession, authOptions } from "@/lib/auth";
import { ADMIN_PORTAL_ROLES, extractUserRoles, hasRole, roleIs } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await safeGetServerSession(authOptions as any);
    const role = (session as any)?.activeRole || session?.user?.role;
    const roles = extractUserRoles(session);
    const isAdmin =
      hasRole(roles, ADMIN_PORTAL_ROLES) || roleIs(role, ADMIN_PORTAL_ROLES);

    if (!session?.user || !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get("state");
    const city = searchParams.get("city");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: any = {};
    if (state) {
      where.state = { equals: state, mode: "insensitive" };
    }
    if (city) {
      where.cityName = { contains: city, mode: "insensitive" };
    }

    // Get waitlist signups with pagination
    const [signups, total] = await Promise.all([
      prisma.cityWaitlist.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.cityWaitlist.count({ where }),
    ]);

    // Aggregate by city for summary
    const cityAggregates = await prisma.cityWaitlist.groupBy({
      by: ["cityName", "state", "placeId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 50,
    });

    // Aggregate by state
    const stateAggregates = await prisma.cityWaitlist.groupBy({
      by: ["state"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentCount = await prisma.cityWaitlist.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Get today's signups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayCount = await prisma.cityWaitlist.count({
      where: {
        createdAt: { gte: today },
      },
    });

    return NextResponse.json({
      signups,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + signups.length < total,
      },
      summary: {
        totalSignups: total,
        todaySignups: todayCount,
        last7DaysSignups: recentCount,
        uniqueCities: cityAggregates.length,
        uniqueStates: stateAggregates.length,
      },
      byCity: cityAggregates.map((agg) => ({
        cityName: agg.cityName,
        state: agg.state,
        placeId: agg.placeId,
        count: agg._count.id,
      })),
      byState: stateAggregates.map((agg) => ({
        state: agg.state,
        count: agg._count.id,
      })),
    });
  } catch (error) {
    console.error("[admin/waitlist] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch waitlist data" },
      { status: 500 }
    );
  }
}
