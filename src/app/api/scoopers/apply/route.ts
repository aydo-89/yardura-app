import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AvailabilityWindow, UserRole } from "@prisma/client";

import { resolveBusinessId } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { upsertScooperApplicant } from "@/lib/marketplace";
import { getTileRepository } from "@/lib/tiles/repository";
import { sendScooperApplicationEmail } from "@/lib/emails/scooper-application";
import { sendAdminScooperApplicationPush } from "@/lib/notifications/push";

const applySchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  phone: z.string().optional(),
  vehicleDetail: z.string().min(3),
  insuranceProofUrl: z.string().url().optional(),
  autoApprove: z.boolean().optional(),
  applicationSource: z.string().min(2).max(40).optional(),
  preferredRadiusMiles: z.coerce.number().min(1).max(50).optional(),
  availabilityNotes: z.string().min(2).max(1000).optional(),
  experienceTags: z.array(z.string().min(2).max(40)).optional(),
  hasReliableTransport: z.boolean().optional(),
  hasSmartphone: z.boolean().optional(),
  canLift: z.boolean().optional(),
  backgroundConsent: z.boolean().optional(),
  termsConsent: z.boolean().optional(),
  driversLicenseState: z.string().min(2).max(2).optional(),
  driversLicenseLast4: z.string().regex(/^\d{4}$/).optional(),
  emergencyContactName: z.string().min(2).max(120).optional(),
  emergencyContactPhone: z.string().min(7).max(30).optional(),
  emergencyContactRelation: z.string().min(2).max(80).optional(),
  homeBaseAddress: z.string().min(4).max(200).optional(),
  homeBaseCity: z.string().min(2).max(80).optional(),
  homeBaseState: z.string().min(2).max(2).optional(),
  homeBaseZip: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
  availability: z
    .array(
      z.object({
        tileSlug: z.string().min(2),
        weekday: z.coerce.number().int().min(0).max(6),
        window: z.nativeEnum(AvailabilityWindow).optional(),
        maxStops: z.coerce.number().int().min(1).max(60).optional(),
      }),
    )
    .min(1, "At least one availability block is required"),
});

export async function POST(request: NextRequest) {
  try {
    const orgId = await resolveBusinessId(request);
    let payload: unknown;
    try {
      payload = await request.json();
    } catch (jsonErr) {
      console.error("[scooper-apply] Failed to parse request JSON:", jsonErr);
      return NextResponse.json(
        { error: "invalid_json", details: "Request body is not valid JSON" },
        { status: 400 },
      );
    }

    const parsed = applySchema.safeParse(payload);
    if (!parsed.success) {
      console.warn("[scooper-apply] Validation failed:", parsed.error.flatten());
      return NextResponse.json(
        { error: "validation_error", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const data = parsed.data;
    const uniqueSlugs = Array.from(new Set(data.availability.map((a) => a.tileSlug)));
    const applicationDetails: Record<string, unknown> = {
      source: data.applicationSource ?? "mobile",
      preferredRadiusMiles: data.preferredRadiusMiles ?? null,
      availabilityNotes: data.availabilityNotes ?? null,
      experienceTags: data.experienceTags ?? null,
      hasReliableTransport: data.hasReliableTransport ?? null,
      hasSmartphone: data.hasSmartphone ?? null,
      canLift: data.canLift ?? null,
      backgroundConsent: data.backgroundConsent ?? null,
      termsConsent: data.termsConsent ?? null,
      driversLicenseState: data.driversLicenseState ?? null,
      driversLicenseLast4: data.driversLicenseLast4 ?? null,
      emergencyContact: {
        name: data.emergencyContactName ?? null,
        phone: data.emergencyContactPhone ?? null,
        relation: data.emergencyContactRelation ?? null,
      },
    };

    const tiles = await prisma.serviceTile.findMany({
      where: {
        orgId,
        slug: { in: uniqueSlugs },
      },
      select: {
        id: true,
        slug: true,
        name: true,
      },
    });

    const ensuredTiles = [...tiles];
    const tileRepository = getTileRepository();
    const unresolved: string[] = [];

    for (const slug of uniqueSlugs) {
      if (ensuredTiles.some((tile) => tile.slug === slug)) continue;

      const repoTile = await tileRepository.getTileBySlug(orgId, slug);
      if (!repoTile) {
        unresolved.push(slug);
        continue;
      }

      const created = await prisma.serviceTile.upsert({
        where: {
          orgId_slug: { orgId, slug },
        },
        update: {
          name: repoTile.tile.name,
          status: repoTile.tile.status,
          minCertifiedScoopers: repoTile.tile.minCertifiedScoopers,
          minCustomerUnits: repoTile.tile.minCustomerUnits,
          coverageRadiusMeters: repoTile.tile.coverageRadiusMeters,
          goLiveDate: repoTile.tile.goLiveDate,
          notes: repoTile.tile.notes ?? null,
          territoryId: repoTile.tile.territoryId,
        },
        create: {
          orgId,
          slug,
          name: repoTile.tile.name,
          status: repoTile.tile.status,
          minCertifiedScoopers: repoTile.tile.minCertifiedScoopers,
          minCustomerUnits: repoTile.tile.minCustomerUnits,
          coverageRadiusMeters: repoTile.tile.coverageRadiusMeters,
          goLiveDate: repoTile.tile.goLiveDate,
          notes: repoTile.tile.notes ?? null,
          territoryId: repoTile.tile.territoryId,
        },
        select: {
          id: true,
          slug: true,
          name: true,
        },
      });

      ensuredTiles.push(created);
    }

    if (unresolved.length) {
      return NextResponse.json(
        {
          error: "unknown_tiles",
          details: `Tiles not found in service catalog for org ${orgId}: ${unresolved.join(", ")}`,
        },
        { status: 404 },
      );
    }

    const availability = data.availability.map((entry) => {
      const tile = ensuredTiles.find((t) => t.slug === entry.tileSlug)!;
      return {
        tileId: tile.id,
        weekday: entry.weekday,
        window: entry.window,
        maxStops: entry.maxStops,
      };
    });

    const profile = await upsertScooperApplicant({
      orgId,
      email: data.email,
      name: data.name,
      phone: data.phone,
      vehicleDetail: data.vehicleDetail,
      insuranceProofUrl: data.insuranceProofUrl,
      availability,
      autoApprove: data.autoApprove,
      homeBaseAddress: data.homeBaseAddress,
      homeBaseCity: data.homeBaseCity,
      homeBaseState: data.homeBaseState,
      homeBaseZip: data.homeBaseZip,
      homeBaseLocation: data.location ? { lat: data.location.lat, lng: data.location.lng } : null,
      preferredTileSlugs: uniqueSlugs,
      applicationDetails,
    });

    const homeBaseLabel = [data.homeBaseAddress, data.homeBaseCity, data.homeBaseZip]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(", ");

    const adminUsers = await prisma.user.findMany({
      where: {
        orgId,
        OR: [
          { role: { in: [UserRole.ADMIN, UserRole.OWNER, UserRole.SALES_REP] } },
          { roles: { hasSome: [UserRole.ADMIN, UserRole.OWNER, UserRole.SALES_REP] } },
        ],
      },
      select: { id: true },
    });

    if (adminUsers.length) {
      void sendAdminScooperApplicationPush({
        userIds: adminUsers.map((user) => user.id),
        applicantName: data.name,
        homeBase: homeBaseLabel || null,
      }).catch(() => null);
    }

    try {
      const preferredTiles = ensuredTiles
        .map((tile) => tile.name ?? tile.slug)
        .filter(Boolean);

      await sendScooperApplicationEmail({
        toEmail: data.email,
        applicantName: data.name,
        appliedAt: new Date(),
        homeBase: homeBaseLabel || null,
        preferredTiles: preferredTiles.length ? preferredTiles : null,
      });
    } catch (emailError) {
      console.warn("[scooper-apply] Failed to send application email:", emailError);
    }

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error) {
    console.error("[scooper-apply] Unhandled error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "server_error", details: message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
