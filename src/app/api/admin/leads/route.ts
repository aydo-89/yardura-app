import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const leadListInclude = Prisma.validator<Prisma.LeadDefaultArgs>()({
  include: {
    territory: {
      select: {
        id: true,
        name: true,
        color: true,
      },
    },
    owner: {
      select: { id: true, name: true, email: true },
    },
  },
});

type LeadWithRelations = Prisma.LeadGetPayload<typeof leadListInclude>;

export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role || (session as any)?.userRole;
    if (
      !session?.user ||
      !["ADMIN", "OWNER", "TECH", "SALES_REP"].includes(role)
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization - admins can only see leads from their org
    // Default to "yardura" org for multi-tenancy while keeping a sensible default
    const userOrgId = (session.user as any).orgId || "yardura";

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const includeConverted = searchParams.get("includeConverted") === "true";
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const pageSizeRaw = parseInt(searchParams.get("pageSize") || "50", 10);
    const pageSize = Math.min(Math.max(pageSizeRaw, 10), 200);
    const skip = (page - 1) * pageSize;
    const leadTypeFilter = searchParams.get("leadType") || undefined;
    const pipelineStageFilter = searchParams.get("pipelineStage") || undefined;
    const ownerIdFilter = searchParams.get("ownerId") || undefined;
    const territoryIdFilter = searchParams.get("territoryId") || undefined;
    const search = searchParams.get("search") || undefined;
    const nextActionStatusFilter = searchParams.get("nextActionStatus") || undefined;
    const dogsMin = searchParams.get("dogsMin");
    const dogsMax = searchParams.get("dogsMax");
    const yardSizeFilter = searchParams.get("yardSize") || undefined;
    const zipCodeFilter = searchParams.get("zipCode") || undefined;
    const frequencyFilter = searchParams.get("frequency") || undefined;
    const lastCleanedBucketFilter = searchParams.get("lastCleanedBucket") || undefined;
    const lastCleanedBefore = searchParams.get("lastCleanedBefore") || undefined;
    const lastCleanedAfter = searchParams.get("lastCleanedAfter") || undefined;
    const addOnFilter = searchParams.get("addOns") || undefined;
    const divertModeFilter = searchParams.get("divertMode") || undefined;
    const waitlistFilter = searchParams.get("waitlist") || undefined;
    const wellnessFilter = searchParams.get("wellnessOptIn") || undefined;
    const sortBy = searchParams.get("sortBy") || "submittedAt";
    const sortOrderParam = (searchParams.get("sortOrder") || "desc").toLowerCase();
    const sortOrder = sortOrderParam === "asc" ? "asc" : "desc";

    // Build where clause based on status filter and organization
    const where: any = {
      orgId: userOrgId, // Always scope to user's organization
    };

    // Filter by status - default to active leads (exclude WON/converted)
    if (status === "all") {
      // When showing all leads, still exclude WON leads by default
      where.status = { not: "WON" };
    } else if (status === "won") {
      where.status = "WON";
    } else if (status === "lost") {
      where.status = "LOST";
    } else if (status === "archived") {
      where.status = "ARCHIVED";
    } else if (status === "active") {
      where.status = { notIn: ["WON", "LOST", "ARCHIVED"] };
    }

    if (!includeConverted && status !== "won") {
      where.convertedToCustomerId = null;
    } else if (!includeConverted && status === "won") {
      where.convertedToCustomerId = { not: null };
    }

    if (leadTypeFilter) {
      where.leadType = leadTypeFilter;
    }

    if (pipelineStageFilter) {
      where.pipelineStage = pipelineStageFilter;
    }

    if (ownerIdFilter) {
      where.ownerId = ownerIdFilter === "NULL" ? null : ownerIdFilter;
    }

    if (territoryIdFilter) {
      where.territoryId =
        territoryIdFilter === "NULL" ? null : territoryIdFilter;
    }

    if (nextActionStatusFilter) {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      if (nextActionStatusFilter === "overdue") {
        where.nextActionAt = { lt: now };
      } else if (nextActionStatusFilter === "today") {
        where.nextActionAt = { gte: startOfDay, lte: endOfDay };
      } else if (nextActionStatusFilter === "upcoming") {
        where.nextActionAt = { gt: endOfDay };
      } else if (nextActionStatusFilter === "none") {
        where.OR = [
          ...(where.OR ?? []),
          { nextActionAt: null },
        ];
      }
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { zipCode: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dogsMin || dogsMax) {
      where.dogs = {};
      if (dogsMin) {
        const value = Number(dogsMin);
        if (!Number.isNaN(value)) {
          where.dogs.gte = value;
        }
      }
      if (dogsMax) {
        const value = Number(dogsMax);
        if (!Number.isNaN(value)) {
          where.dogs.lte = value;
        }
      }
      if (!Object.keys(where.dogs).length) {
        delete where.dogs;
      }
    }

    if (yardSizeFilter && yardSizeFilter !== "all") {
      where.yardSize = yardSizeFilter;
    }

    if (zipCodeFilter) {
      where.zipCode = { contains: zipCodeFilter, mode: "insensitive" };
    }

    if (frequencyFilter && frequencyFilter !== "all") {
      where.frequency = frequencyFilter;
    }

    if (lastCleanedBucketFilter && lastCleanedBucketFilter !== "all") {
      where.lastCleanedBucket = lastCleanedBucketFilter;
    }

    if (lastCleanedBefore || lastCleanedAfter) {
      where.lastCleanedDate = {};
      if (lastCleanedBefore) {
        const value = new Date(lastCleanedBefore);
        if (!Number.isNaN(value.getTime())) {
          where.lastCleanedDate.lte = value;
        }
      }
      if (lastCleanedAfter) {
        const value = new Date(lastCleanedAfter);
        if (!Number.isNaN(value.getTime())) {
          where.lastCleanedDate.gte = value;
        }
      }
      if (!Object.keys(where.lastCleanedDate).length) {
        delete where.lastCleanedDate;
      }
    }

    if (addOnFilter === "with") {
      where.OR = [...(where.OR ?? []), { deodorize: true }, { sprayDeck: true }];
    } else if (addOnFilter === "without") {
      where.deodorize = false;
      where.sprayDeck = false;
    }

    if (divertModeFilter && divertModeFilter !== "all") {
      if (divertModeFilter === "none") {
        where.divertMode = { in: ["none", null] };
      } else if (divertModeFilter === "compost") {
        where.OR = [
          ...(where.OR ?? []),
          { divertMode: "compost" },
          { divertMode: { notIn: ["none", "takeaway", null] } },
        ];
      } else {
        where.divertMode = divertModeFilter;
      }
    }

    if (waitlistFilter === "joined") {
      where.pricingBreakdown = {
        path: ["metadata", "wellnessWaitlist"],
        not: Prisma.DbNull,
      } as unknown as Prisma.JsonFilter;
    } else if (waitlistFilter === "not_joined") {
      where.OR = [
        ...(where.OR ?? []),
        {
          pricingBreakdown: {
            path: ["metadata", "wellnessWaitlist"],
            equals: Prisma.DbNull,
          },
        } as unknown as Prisma.JsonFilter,
      ];
    }

    if (wellnessFilter === "true") {
      where.wellnessOptIn = true;
    } else if (wellnessFilter === "false") {
      where.wellnessOptIn = false;
    }

    const sortDirection = (sortOrder === "asc" ? "asc" : "desc") as Prisma.SortOrder;

    const orderBy = (() => {
      switch (sortBy) {
        case "dogs":
          return { dogs: sortDirection };
        case "zipCode":
          return { zipCode: sortDirection };
        case "frequency":
          return { frequency: sortDirection };
        case "lastCleanedDate":
          return { lastCleanedDate: sortDirection };
        case "nextActionAt":
          return { nextActionAt: sortDirection };
        case "priority":
          return { priority: sortDirection };
        case "submittedAt":
        default:
          return { submittedAt: sortDirection };
      }
    })();

    const leads = await prisma.lead.findMany({
      where,
      orderBy,
      take: pageSize,
      skip,
      include: leadListInclude.include,
    });

    const serializedLeads = leads.map((lead: LeadWithRelations) => {
      let metadata: any = null;
      if (lead.pricingBreakdown) {
        try {
          const raw =
            typeof lead.pricingBreakdown === "string"
              ? JSON.parse(lead.pricingBreakdown)
              : lead.pricingBreakdown;
          metadata = raw?.metadata || null;
        } catch (error) {
          console.warn("Failed to parse lead pricing metadata", error);
        }
      }

      return {
        ...lead,
        pricingBreakdown: undefined,
        pipelineStage: lead.pipelineStage,
        leadType: lead.leadType,
        territory: lead.territory,
        owner: lead.owner,
        lastActivityAt: lead.lastActivityAt,
        nextActionAt: lead.nextActionAt,
        preferredStartDate: metadata?.preferredStartDate || null,
        preferredContactMethods: metadata?.preferredContactMethods || null,
        howDidYouHear: metadata?.howDidYouHear || lead.referralSource || null,
        specialInstructions:
          metadata?.specialRequests || lead.specialInstructions || null,
      };
    });

    const total = await prisma.lead.count({ where });

    const [inboundCount, outboundCount, assignedCount, unassignedCount, overdueCount, todayCount, thisWeekCount] =
      await Promise.all([
        prisma.lead.count({ where: { ...where, leadType: "inbound" } }),
        prisma.lead.count({ where: { ...where, leadType: "outbound" } }),
        prisma.lead.count({ where: { ...where, ownerId: { not: null } } }),
        prisma.lead.count({ where: { ...where, ownerId: null } }),
        prisma.lead.count({
          where: {
            ...where,
            nextActionAt: { lt: new Date() },
          },
        }),
        prisma.lead.count({
          where: {
            ...where,
            nextActionAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        }),
        prisma.lead.count({
          where: {
            ...where,
            submittedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

    const pageCount = Math.max(Math.ceil(total / pageSize), 1);
    const safePage = Math.min(page, pageCount);

    return NextResponse.json({
      leads: serializedLeads,
      meta: {
        total,
        page: safePage,
        pageSize,
        pageCount,
        sortBy,
        sortOrder,
      },
      stats: {
        inboundCount,
        outboundCount,
        assignedCount,
        unassignedCount,
        overdueCount,
        todayCount,
        thisWeekCount,
      },
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role || (session as any)?.userRole;
    if (
      !session?.user ||
      !["ADMIN", "OWNER", "SALES_MANAGER", "SALES_REP", "FRANCHISE_OWNER"].includes(
        role,
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Default to "yardura" org for multi-tenancy while keeping a sensible default
    const userOrgId = (session.user as any).orgId || "yardura";

    let body: unknown = null;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    const ids = Array.isArray((body as any)?.ids)
      ? ((body as any).ids as unknown[]).filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [];

    if (!ids.length) {
      return NextResponse.json(
        { error: "No lead IDs provided" },
        { status: 400 },
      );
    }

    const scopedLeads = await prisma.lead.findMany({
      where: {
        id: { in: ids },
        orgId: userOrgId,
      },
      select: { id: true },
    });

    if (!scopedLeads.length) {
      return NextResponse.json({ deleted: 0 });
    }

    const leadIds = scopedLeads.map((lead) => lead.id);

    const deleteCount = await prisma.$transaction(async (tx) => {
      if (leadIds.length === 0) {
        return 0;
      }

      await tx.leadActivity.deleteMany({
        where: {
          leadId: {
            in: leadIds,
          },
        },
      });

      await tx.leadCadenceEnrollment.deleteMany({
        where: {
          leadId: {
            in: leadIds,
          },
        },
      });

      await tx.tripStop.updateMany({
        where: {
          leadId: {
            in: leadIds,
          },
        },
        data: {
          leadId: null,
        },
      });

      const result = await tx.lead.deleteMany({
        where: {
          id: { in: leadIds },
          orgId: userOrgId,
        },
      });

      return result.count;
    });

    return NextResponse.json({ deleted: deleteCount });
  } catch (error) {
    console.error("Error deleting leads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
