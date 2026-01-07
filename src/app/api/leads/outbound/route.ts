import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveApiAuth } from "@/lib/auth/api-auth";
import { prisma } from "@/lib/prisma";
import { getTileRepository } from "@/lib/tiles/repository";
import type { ServiceTileStatus } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

const createLeadSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dogs: z.union([z.number(), z.string()]).optional(),
  yardSize: z.string().optional(),
  frequency: z.string().optional(),
  specialInstructions: z.string().optional(),
  address: z
    .object({
      line1: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    })
    .optional(),
  territoryId: z.string().optional(),
  pipelineStage: z.string().optional(),
  ownerId: z.string().optional(),
  campaignId: z.string().optional(),
  initialActivity: z
    .object({
      type: z.string(),
      channel: z.string().optional(),
      occurredAt: z.string().datetime().optional(),
      result: z.string().optional(),
      notes: z.string().optional(),
      followUpAt: z.string().datetime().optional(),
      location: z
        .object({
          lat: z.number(),
          lng: z.number(),
          accuracy: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

function forbidden(message = "Unauthorized") {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function toStageColor(stage?: string | null) {
  if (!stage) return "default";
  switch ((stage || "").toLowerCase()) {
    case "cold":
      return "cyan";
    case "contacted":
      return "blue";
    case "scheduled":
      return "green";
    case "follow_up":
    case "follow-up":
      return "amber";
    case "won":
      return "emerald";
    case "lost":
      return "rose";
    default:
      return "slate";
  }
}

function extractLeadMetadata(pricingBreakdown: unknown) {
  if (!pricingBreakdown) {
    return {
      preferredStartDate: null,
      preferredContactMethods: null,
      howDidYouHear: null,
    };
  }
  try {
    const raw =
      typeof pricingBreakdown === "string"
        ? JSON.parse(pricingBreakdown)
        : pricingBreakdown;
    const metadata = raw?.metadata ?? raw ?? {};
    return {
      preferredStartDate: metadata?.preferredStartDate ?? null,
      preferredContactMethods: metadata?.preferredContactMethods ?? null,
      howDidYouHear: metadata?.howDidYouHear ?? null,
    };
  } catch {
    return {
      preferredStartDate: null,
      preferredContactMethods: null,
      howDidYouHear: null,
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await resolveApiAuth(req);
    if (!auth?.userId) {
      return forbidden();
    }

    const role = auth.role;
    const userId = auth.userId;
    const orgId = auth.orgId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization not set" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || `${DEFAULT_PAGE_SIZE}`, 10),
      100,
    );
    const cursor = searchParams.get("cursor") || undefined;
    const pipelineStage = searchParams.get("pipelineStage") || undefined;
    const ownerIdParam = searchParams.get("ownerId") || undefined;
    const territoryId = searchParams.get("territoryId") || undefined;
    const leadType = searchParams.get("leadType") || "outbound";
    const search = searchParams.get("search") || undefined;
    const nextActionBefore = searchParams.get("nextActionBefore") || undefined;
    const includeConverted = searchParams.get("includeConverted") === "true";
    const includeCadence = searchParams.get("includeCadence") === "true";

    const where: any = {
      orgId,
      leadType,
    };

    if (!includeConverted) {
      where.convertedToCustomerId = null;
      where.status = { not: "WON" };
    }

    if (pipelineStage) {
      where.pipelineStage = pipelineStage;
    }

    if (territoryId) {
      where.territoryId = territoryId === "NULL" ? null : territoryId;
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

    if (role === "SALES_REP" && userId) {
      where.AND = [
        {
          OR: [{ ownerId: userId }, { salesRepId: userId }],
        },
      ];
    } else if (ownerIdParam) {
      where.ownerId = ownerIdParam === "NULL" ? null : ownerIdParam;
    }

    const leads = await prisma.lead.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
      include: {
        territory: { select: { id: true, name: true, color: true } },
        owner: { select: { id: true, name: true, email: true } },
        salesRep: { select: { id: true, name: true, email: true } },
        lastActivity: true,
        cadenceEnrollments: includeCadence
          ? {
              where: { status: { in: ["active", "paused"] } },
              orderBy: { startedAt: "desc" },
              select: {
                id: true,
                cadenceId: true,
                nextRunAt: true,
                status: true,
                cadence: { select: { id: true, name: true } },
              },
            }
          : false,
      },
    });

    let nextCursor: string | null = null;
    if (leads.length > limit) {
      const nextItem = leads.pop();
      nextCursor = nextItem?.id ?? null;
    }

    const now = Date.now();

    const usePostgisTiles = process.env.ENABLE_POSTGIS_TILES === "true";
    const tileRepository = usePostgisTiles ? getTileRepository() : null;
    const tileCache = new Map<string, { slug: string; status: ServiceTileStatus }>();

    const mapped = await Promise.all(
      leads.map(async (lead) => {
        const rawLocation = lead.lastActivity?.location as
          | { type?: string; coordinates?: unknown; accuracy?: unknown }
          | undefined;
      let lastActivityLocation: {
        lat: number;
        lng: number;
        accuracy?: number | null;
      } | null = null;

      if (
        rawLocation &&
        rawLocation.type === "Point" &&
        Array.isArray(rawLocation.coordinates) &&
        rawLocation.coordinates.length >= 2
      ) {
        const [lng, lat] = rawLocation.coordinates as Array<number>;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          lastActivityLocation = {
            lat,
            lng,
            accuracy:
              typeof rawLocation.accuracy === "number"
                ? rawLocation.accuracy
                : null,
          };
        }
      }

      const metadata = extractLeadMetadata(lead.pricingBreakdown);
      const owner = lead.owner ?? lead.salesRep ?? null;
      const slaMinutes = lead.nextActionAt
        ? Math.round((lead.nextActionAt.getTime() - now) / 60000)
        : null;

        let serviceArea: {
          slug: string;
          status: ServiceTileStatus;
        } | null = null;

        if (tileRepository && lead.zipCode) {
          const cacheKey = lead.zipCode;
          if (tileCache.has(cacheKey)) {
            serviceArea = tileCache.get(cacheKey)!;
          } else {
            try {
              const tile = await tileRepository.findTileByZip(orgId, cacheKey, {
                metricsLimit: 1,
              });
              if (tile) {
                serviceArea = {
                  slug: tile.tile.slug,
                  status: tile.tile.status,
                };
                tileCache.set(cacheKey, serviceArea);
              } else {
                tileCache.set(cacheKey, null as any);
              }
            } catch (error) {
              console.error("lead tile lookup failed", error);
              tileCache.set(cacheKey, null as any);
            }
          }
          if ((tileCache.get(cacheKey) as any) === null) {
            serviceArea = null;
          }
        }

        return {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        dogs: lead.dogs,
        leadType: lead.leadType,
        pipelineStage: lead.pipelineStage,
        stageColor: toStageColor(lead.pipelineStage),
        owner,
        territory: lead.territory,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zipCode: lead.zipCode,
        latitude: lead.latitude,
        longitude: lead.longitude,
        lastActivity: lead.lastActivity
          ? {
              id: lead.lastActivity.id,
              type: lead.lastActivity.type,
              result: lead.lastActivity.result,
              notes: lead.lastActivity.notes,
              occurredAt: lead.lastActivity.occurredAt,
              location: lastActivityLocation,
            }
          : null,
          submittedAt: lead.submittedAt,
          lastActivityAt: lead.lastActivityAt,
          nextActionAt: lead.nextActionAt,
          nextActionSlaMinutes: slaMinutes,
          preferredStartDate: metadata.preferredStartDate,
          preferredContactMethods: metadata.preferredContactMethods,
          howDidYouHear: metadata.howDidYouHear ?? lead.referralSource,
          cadenceEnrollments: includeCadence
            ? lead.cadenceEnrollments
            : undefined,
          serviceArea,
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      data: {
        leads: mapped,
        pageInfo: { nextCursor },
      },
    });
  } catch (error) {
    console.error("GET /api/leads/outbound error", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await resolveApiAuth(req);
    if (!auth?.userId) {
      return forbidden();
    }

    const role = auth.role;
    const orgId = auth.orgId;
    const sessionUserId = auth.userId;

    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "Organization not set" },
        { status: 400 },
      );
    }

    const json = await req.json();
    const parsed = createLeadSchema.parse(json);

    const isManager = [
      "ADMIN",
      "OWNER",
      "SALES_MANAGER",
      "FRANCHISE_OWNER",
    ].includes(role || "");

    const ownerId = isManager
      ? (parsed.ownerId ?? sessionUserId)
      : sessionUserId;

    if (!ownerId) {
      return NextResponse.json(
        { ok: false, error: "Owner could not be determined" },
        { status: 400 },
      );
    }

    if (parsed.territoryId) {
      const territory = await prisma.territory.findFirst({
        where: { id: parsed.territoryId, orgId },
      });
      if (!territory) {
        return NextResponse.json(
          { ok: false, error: "Territory not found" },
          { status: 404 },
        );
      }
    }

    const email =
      parsed.email ?? `outbound-${crypto.randomUUID()}@leads.yardura`;

    let dogsValue: number | null = null;
    if (typeof parsed.dogs === "number") {
      if (Number.isFinite(parsed.dogs)) {
        dogsValue = Math.max(0, Math.round(parsed.dogs));
      }
    } else if (typeof parsed.dogs === "string") {
      const numeric = Number.parseInt(parsed.dogs, 10);
      if (!Number.isNaN(numeric)) {
        dogsValue = Math.max(0, numeric);
      }
    }

    const yardSizeValue =
      parsed.yardSize && parsed.yardSize !== "__unset"
        ? parsed.yardSize
        : undefined;

    const frequencyValue =
      parsed.frequency && parsed.frequency !== "__unset"
        ? parsed.frequency
        : undefined;

    const specialInstructionsValue = parsed.specialInstructions
      ? parsed.specialInstructions.trim()
      : "";

    const leadData = {
      orgId,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email,
      phone: parsed.phone,
      serviceType: "residential" as const,
      source: "outbound",
      leadType: "outbound",
      pipelineStage: parsed.pipelineStage ?? "cold",
      territoryId: parsed.territoryId,
      campaignId: parsed.campaignId,
      ownerId,
      createdById: sessionUserId,
      address: parsed.address?.line1,
      city: parsed.address?.city,
      state: parsed.address?.state,
      zipCode: parsed.address?.zip,
      latitude: parsed.address?.latitude,
      longitude: parsed.address?.longitude,
      dogs: dogsValue ?? undefined,
      yardSize: yardSizeValue,
      frequency: frequencyValue,
      specialInstructions:
        specialInstructionsValue.length > 0
          ? specialInstructionsValue
          : undefined,
      lastActivityAt: parsed.initialActivity?.occurredAt
        ? new Date(parsed.initialActivity.occurredAt)
        : undefined,
      nextActionAt: parsed.initialActivity?.followUpAt
        ? new Date(parsed.initialActivity.followUpAt)
        : parsed.pipelineStage === "cold"
          ? new Date(Date.now() + 24 * 60 * 60 * 1000)
          : undefined,
    } as const;

    const result = await prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({
        data: leadData,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          territory: { select: { id: true, name: true, color: true } },
        },
      });

      let activity = null;
      if (parsed.initialActivity) {
        activity = await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            orgId,
            userId: sessionUserId,
            type: parsed.initialActivity.type,
            channel: parsed.initialActivity.channel,
            occurredAt: parsed.initialActivity.occurredAt
              ? new Date(parsed.initialActivity.occurredAt)
              : undefined,
            result: parsed.initialActivity.result,
            notes: parsed.initialActivity.notes,
            followUpAt: parsed.initialActivity.followUpAt
              ? new Date(parsed.initialActivity.followUpAt)
              : undefined,
            location: parsed.initialActivity.location
              ? {
                  type: "Point",
                  coordinates: [
                    parsed.initialActivity.location.lng,
                    parsed.initialActivity.location.lat,
                  ],
                  accuracy: parsed.initialActivity.location.accuracy,
                }
              : undefined,
          },
        });

        await tx.lead.update({
          where: { id: lead.id },
          data: {
            lastActivityId: activity.id,
            lastActivityAt: activity.occurredAt,
            nextActionAt: parsed.initialActivity.followUpAt
              ? new Date(parsed.initialActivity.followUpAt)
              : lead.nextActionAt,
          },
        });
      }

      return { lead, activity };
    });

    return NextResponse.json({ ok: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads/outbound error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Validation error", details: error.flatten() },
        { status: 400 },
      );
    }

    if ((error as any)?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Lead already exists with that email" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
