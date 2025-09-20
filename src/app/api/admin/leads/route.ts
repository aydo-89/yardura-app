import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
    const userOrgId = (session.user as any).orgId;
    if (!userOrgId) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const leadTypeFilter = searchParams.get("leadType") || undefined;
    const pipelineStageFilter = searchParams.get("pipelineStage") || undefined;
    const ownerIdFilter = searchParams.get("ownerId") || undefined;
    const territoryIdFilter = searchParams.get("territoryId") || undefined;
    const search = searchParams.get("search") || undefined;
    const nextActionBefore = searchParams.get("nextActionBefore") || undefined;

    // Build where clause based on status filter and organization
    const where: any = {
      orgId: userOrgId, // Always scope to user's organization
    };
    if (status !== "all") {
      // For now, we don't have status tracking, so all leads are "new"
      // In the future, you might add status fields like contactedAt, convertedAt, etc.
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

    if (nextActionBefore) {
      where.nextActionAt = { lte: new Date(nextActionBefore) };
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

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      take: limit,
      skip: offset,
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

    const serializedLeads = leads.map((lead) => {
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

    return NextResponse.json({
      leads: serializedLeads,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
