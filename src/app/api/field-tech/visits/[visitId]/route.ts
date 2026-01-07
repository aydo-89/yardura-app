import { NextRequest, NextResponse } from "next/server";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { ensureVisitGeoSnapshot } from "@/lib/dispatch/geo";
import { createSignedUrl } from "@/lib/supabase-admin";
import { env } from "@/lib/env";

type RouteParams = { params: Promise<{ visitId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { visitId } = await params;
  const auth = await getScooperAuth(_request);
  const userId = auth?.userId;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const visit = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          addressLine1: true,
          city: true,
          zip: true,
          state: true,
          latitude: true,
          longitude: true,
          notes: true,
        },
      },
      job: {
        select: {
          id: true,
          frequency: true,
          deodorizeMode: true,
          billingPlan: {
            select: {
              metadata: true,
            },
          },
        },
      },
      media: {
        orderBy: { capturedAt: "asc" },
      },
      insights: true,
      communications: {
        orderBy: { createdAt: "desc" },
      },
        routeStop: true,
    },
  });

  if (!visit || visit.assignedToId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Generate signed URLs for media
  const bucket = env.STORAGE_BUCKET;
  const mediaWithUrls = await Promise.all(
    visit.media.map(async (item) => {
      let url: string | null = null;
      if (bucket) {
        try {
          url = await createSignedUrl(bucket, item.storagePath, 60 * 60); // 1 hour
        } catch (error) {
          console.error("[field-tech-visit] Failed to sign media URL", {
            mediaId: item.id,
            error,
          });
        }
      }

      return {
        ...item,
        url,
      };
    }),
  );

  let geo: { latitude: number; longitude: number; source: string } | null = null;
  const orgId = visit.orgId ?? auth?.orgId ?? undefined;

  if (orgId) {
    try {
      geo = await ensureVisitGeoSnapshot({
        orgId,
        customer: {
          id: visit.customer?.id ?? undefined,
          latitude: (visit.customer as any)?.latitude ?? undefined,
          longitude: (visit.customer as any)?.longitude ?? undefined,
          addressLine1: visit.customer?.addressLine1 ?? undefined,
          city: visit.customer?.city ?? undefined,
          state: (visit.customer as any)?.state ?? undefined,
          zip: visit.customer?.zip ?? undefined,
        },
        visit: {
          id: visit.id,
          customerId: visit.customerId ?? undefined,
          metadata: visit.metadata ?? undefined,
          addressLine1: visit.customer?.addressLine1 ?? undefined,
          city: visit.customer?.city ?? undefined,
          state: (visit.customer as any)?.state ?? undefined,
          zip: visit.customer?.zip ?? undefined,
        },
      });
    } catch (error) {
      console.warn("[field-tech-visit] Unable to resolve geo snapshot", { visitId, error });
      geo = null;
    }
  }

  return NextResponse.json({
    ok: true,
    visit: {
      ...visit,
      media: mediaWithUrls,
      geo,
    },
  });
}

export const runtime = "nodejs";
