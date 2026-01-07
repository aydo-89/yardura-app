import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, startOfDay, endOfDay, isBefore, isAfter } from "date-fns";
import { getZonedWeekday, SERVICE_TIME_ZONE } from "@/lib/timezone";
import { buildUserRoleFilter } from "@/lib/auth/role-filters";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId") || "yardura";
    const days = parseInt(searchParams.get("days") || "30");
    const zipCode = searchParams.get("zipCode");

    if (!zipCode) {
      return NextResponse.json(
        { error: "zipCode parameter is required" },
        { status: 400 }
      );
    }

    // Get all active technicians for this org
    const technicians = await prisma.user.findMany({
      where: {
        orgId,
        ...buildUserRoleFilter([UserRole.TECH, UserRole.SALES_REP], {
          includeProfileFallback: true,
        }),
      }
    });

    // Get technician capacity settings from business config
    const businessConfig = await prisma.businessConfig.findFirst({
      where: { orgId },
      select: { operations: true }
    });

    const operations = businessConfig?.operations as any;
    const defaultCapacityPerDay = operations?.technicianCapacityPerDay || 6;
    const technicianCapacities = operations?.technicianCapacities || {};

    // Generate date range (next 30 days)
    const today = new Date();
    const dates = [];
    const leadDays = Math.max(2, operations?.minimumSchedulingLeadDays ?? 2);

    for (let i = leadDays; i < leadDays + days; i++) {
      const date = addDays(today, i);
      dates.push(date);
    }

    // Check availability for each date
    const availability = await Promise.all(
      dates.map(async (date) => {
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);

        // Skip past dates
        if (isBefore(date, startOfDay(today))) {
          return {
            date: date.toISOString().split('T')[0],
            available: false,
            reason: "Past date"
          };
        }

        // Skip weekends if configured
        if (operations?.weekendScheduling === false &&
            (getZonedWeekday(date, SERVICE_TIME_ZONE) === 0 ||
              getZonedWeekday(date, SERVICE_TIME_ZONE) === 6)) {
          return {
            date: date.toISOString().split('T')[0],
            available: false,
            reason: "Weekend scheduling disabled"
          };
        }

        // Count existing visits for this date
        const existingVisits = await prisma.serviceVisit.count({
          where: {
            scheduledDate: {
              gte: dayStart,
              lte: dayEnd
            },
            status: {
              in: ["SCHEDULED", "IN_PROGRESS"]
            },
            assignedToId: {
              not: null
            }
          }
        });

        // Calculate total capacity across all technicians
        let totalCapacity = 0;
        for (const tech of technicians) {
          const techCapacity = technicianCapacities[tech.id] || defaultCapacityPerDay;
          totalCapacity += techCapacity;
        }

        const available = existingVisits < totalCapacity;

        return {
          date: date.toISOString().split('T')[0],
          available,
          totalCapacity,
          bookedCount: existingVisits,
          reason: available ? null : "Fully booked"
        };
      })
    );

    return NextResponse.json({
      availability,
      techniciansCount: technicians.length,
      defaultCapacityPerDay
    });

  } catch (error) {
    console.error("Error fetching availability:", error);
    return NextResponse.json(
      { error: "Failed to fetch availability" },
      { status: 500 }
    );
  }
}
