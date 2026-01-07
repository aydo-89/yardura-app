import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/api-auth";
import { calculatePrice } from "@/lib/priceEstimator";
import type {
  Frequency as PricingFrequency,
  YardSize as PricingYardSize,
} from "@/lib/priceEstimator";
import { getZoneMultiplierForZip } from "@/lib/zip-eligibility";

const patchSchema = z.object({
  ownerId: z.union([z.string(), z.null()]).optional(),
});

const ALLOWED_ROLES = new Set([
  "ADMIN",
  "OWNER",
  "TECH",
  "SALES_REP",
  "SALES_MANAGER",
  "FRANCHISE_OWNER",
]);
const LEGACY_DIVERT_MODE_PATTERN = /^\d{1,3}%?$/;

const normalizeDivertMode = (value?: string | null) => {
  if (!value) return "none";
  const normalized = value.toLowerCase().trim();
  if (normalized === "takeaway") return "takeaway";
  if (normalized === "compost") return "compost";
  if (LEGACY_DIVERT_MODE_PATTERN.test(normalized)) return "compost";
  return normalized;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leadId } = await params;

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 },
      );
    }

    const includePricing = request.nextUrl.searchParams.get("includePricing");

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        orgId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        serviceType: true,
        dogs: true,
        yardSize: true,
        frequency: true,
        address: true,
        city: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        deodorize: true,
        deodorizeMode: true,
        sprayDeck: true,
        sprayDeckMode: true,
        divertMode: true,
        areasToClean: true,
        submittedAt: true,
        initialClean: true,
        daysSinceLastCleanup: true,
        lastCleanedBucket: true,
        lastCleanedDate: true,
        estimatedPrice: true,
        pricingBreakdown: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Parse areasToClean if it's stored as JSON string
    let parsedAreasToClean = lead.areasToClean;
    if (typeof lead.areasToClean === "string") {
      try {
        parsedAreasToClean = JSON.parse(lead.areasToClean);
      } catch (e) {
        // If parsing fails, keep as string
      }
    }

    // Construct addOns object from individual fields
    const addOns = {
      deodorize: lead.deodorize,
      deodorizeMode: lead.deodorizeMode,
      sprayDeck: lead.sprayDeck,
      sprayDeckMode: lead.sprayDeckMode,
      divertMode: normalizeDivertMode(lead.divertMode),
    };

    let pricing: any = lead.pricingBreakdown;
    if (typeof pricing === "string") {
      try {
        pricing = JSON.parse(pricing);
      } catch (error) {
        pricing = null;
      }
    }

    const normalizeYardSize = (value: string | null | undefined) => {
      if (!value) return null;
      const allowed: PricingYardSize[] = ["small", "medium", "large", "xl"];
      const normalized = value.toLowerCase();
      return allowed.includes(normalized as PricingYardSize)
        ? (normalized as PricingYardSize)
        : null;
    };

    const normalizeFrequency = (value: string | null | undefined) => {
      if (!value) return null;
      const normalized = value.toLowerCase();
      const allowed: PricingFrequency[] = [
        "weekly",
        "biweekly",
        "twice-weekly",
        "monthly",
        "onetime",
      ];
      return allowed.includes(normalized as PricingFrequency)
        ? (normalized as PricingFrequency)
        : null;
    };

    const buildAddOnsForPricing = () => {
      const addOns: Record<string, any> = {};
      if (lead.deodorize && lead.deodorizeMode) {
        addOns.deodorize = { mode: lead.deodorizeMode };
      }
      if (lead.sprayDeck && lead.sprayDeckMode) {
        addOns["spray-deck"] = { mode: lead.sprayDeckMode };
      }
      if (lead.divertMode && lead.divertMode !== "none") {
        const normalized = normalizeDivertMode(lead.divertMode);
        if (normalized === "takeaway") {
          addOns["divert-takeaway"] = true;
        } else if (normalized === "compost") {
          addOns["divert-compost"] = true;
        }
      }
      return addOns;
    };

    if (includePricing && !pricing) {
      const dogs = lead.dogs ?? undefined;
      const yardSize = normalizeYardSize(lead.yardSize ?? undefined);
      const frequency = normalizeFrequency(lead.frequency ?? undefined);

      if (dogs && yardSize && frequency) {
        let zoneMultiplier = 1;
        if (lead.zipCode) {
          try {
            zoneMultiplier = await getZoneMultiplierForZip(
              lead.zipCode,
              lead.orgId,
            );
          } catch (error) {
            console.warn("Unable to derive zone multiplier for lead", leadId, error);
          }
        }

        try {
          pricing = await calculatePrice({
            dogs,
            yardSize,
            frequency,
            addons: buildAddOnsForPricing(),
            address: lead.address ?? undefined,
            propertyType:
              lead.serviceType === "commercial" ? "commercial" : "residential",
            lastCleanedBucket: lead.lastCleanedBucket ?? undefined,
            lastCleanedDate: lead.lastCleanedDate
              ? lead.lastCleanedDate.toISOString()
              : undefined,
            deepCleanAssessment: lead.daysSinceLastCleanup
              ? { daysSinceLastCleanup: lead.daysSinceLastCleanup }
              : undefined,
            initialClean: Boolean(lead.initialClean),
            zoneMultiplier,
            businessId: lead.orgId,
          });
        } catch (error) {
          console.warn("Failed to compute pricing for lead", leadId, error);
        }
      }
    }

    return NextResponse.json({
      ...lead,
      addOns,
      areasToClean: parsedAreasToClean,
      createdAt: lead.submittedAt, // For backward compatibility
      pricing,
      estimatedPrice: lead.estimatedPrice,
    });
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await resolveApiAuth(request);
    const hasAccess =
      (auth?.role && ALLOWED_ROLES.has(auth.role)) ||
      (auth?.roles ?? []).some((role) => ALLOWED_ROLES.has(role));
    if (!auth?.userId || !hasAccess) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const orgId = auth.orgId;
    const sessionUserId = auth.userId;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "User is not associated with an organization" },
        { status: 403 },
      );
    }

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ ok: false, error: "Lead ID is required" }, { status: 400 });
    }

    const json = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success || typeof parsed.data.ownerId === "undefined") {
      return NextResponse.json(
        { ok: false, error: "ownerId is required" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findFirst({ where: { id: leadId, orgId } });
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    let resolvedOwnerId: string | null = null;
    const requestedOwnerId = parsed.data.ownerId;

    if (typeof requestedOwnerId === "string") {
      const ownerId = requestedOwnerId.toLowerCase() === "self" ? sessionUserId : requestedOwnerId;
      if (!ownerId) {
        return NextResponse.json({ ok: false, error: "Invalid owner ID" }, { status: 400 });
      }

      const owner = await prisma.user.findFirst({ where: { id: ownerId, orgId } });
      if (!owner) {
        return NextResponse.json({ ok: false, error: "Sales rep not found" }, { status: 404 });
      }

      resolvedOwnerId = ownerId;
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { ownerId: resolvedOwnerId },
    });

    return NextResponse.json({ ok: true, data: { id: leadId, ownerId: resolvedOwnerId } });
  } catch (error) {
    console.error("PATCH /api/leads/[id] error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await resolveApiAuth(_request);
    const hasAccess =
      (auth?.role && ALLOWED_ROLES.has(auth.role)) ||
      (auth?.roles ?? []).some((role) => ALLOWED_ROLES.has(role));
    if (!auth?.userId || !hasAccess) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const orgId = auth.orgId;
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "User is not associated with an organization" },
        { status: 403 },
      );
    }

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json(
        { ok: false, error: "Lead ID is required" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, orgId },
      select: { id: true },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: "Lead not found" },
        { status: 404 },
      );
    }

    await prisma.$transaction([
      prisma.leadActivity.deleteMany({ where: { leadId } }),
      prisma.leadCadenceEnrollment.deleteMany({ where: { leadId } }),
      prisma.tripStop.updateMany({ where: { leadId }, data: { leadId: null } }),
      prisma.lead.delete({ where: { id: leadId } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/leads/[id] error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
