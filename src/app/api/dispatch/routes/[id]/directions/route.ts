import { NextRequest, NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDispatchSchema } from "@/lib/dispatch/schema-guard";
import { fetchDrivingDirections } from "@/lib/google/maps";
import { ensureVisitGeoSnapshot } from "@/lib/dispatch/geo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Route id required" }, { status: 400 });
  }

  await ensureDispatchSchema();

  try {
    const route = await prisma.routeInstance.findUnique({
      where: { id },
      select: {
        orgId: true,
        stops: {
          orderBy: { position: "asc" },
          select: {
            serviceVisit: {
              select: {
                id: true,
                customerId: true,
                metadata: true,
                customer: {
                  select: {
                    id: true,
                    latitude: true,
                    longitude: true,
                    addressLine1: true,
                    city: true,
                    state: true,
                    zip: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!route) {
      return NextResponse.json({ error: "Route not found" }, { status: 404 });
    }

    const sessionOrgId = (session.user as any)?.orgId ?? null;
    if (sessionOrgId && route.orgId && sessionOrgId !== route.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const orgContext = route.orgId ?? sessionOrgId ?? undefined;

    const stopCoords = [] as Array<{ lat: number; lng: number }>;

    for (const stop of route.stops) {
      const visit = stop.serviceVisit;
      if (!visit) {
        continue;
      }

      let lat = visit.customer?.latitude ?? undefined;
      let lng = visit.customer?.longitude ?? undefined;

      if (
        (typeof lat !== "number" || Number.isNaN(lat) || typeof lng !== "number" || Number.isNaN(lng)) &&
        orgContext
      ) {
        try {
          const geo = await ensureVisitGeoSnapshot({
            orgId: orgContext,
            customer: visit.customer
              ? {
                  id: visit.customer.id ?? undefined,
                  addressLine1: visit.customer.addressLine1 ?? undefined,
                  city: visit.customer.city ?? undefined,
                  state: visit.customer.state ?? undefined,
                  zip: visit.customer.zip ?? undefined,
                  latitude: visit.customer.latitude ?? undefined,
                  longitude: visit.customer.longitude ?? undefined,
                }
              : undefined,
            visit: {
              id: visit.id,
              customerId: visit.customerId ?? undefined,
              metadata: visit.metadata ?? undefined,
              addressLine1: visit.customer?.addressLine1 ?? undefined,
              city: visit.customer?.city ?? undefined,
              state: visit.customer?.state ?? undefined,
              zip: visit.customer?.zip ?? undefined,
            },
          });

          lat = geo.latitude;
          lng = geo.longitude;
        } catch (error) {
          console.warn("dispatch.routes.directions.geo", error);
        }
      }

      if (
        typeof lat === "number" &&
        !Number.isNaN(lat) &&
        typeof lng === "number" &&
        !Number.isNaN(lng)
      ) {
        stopCoords.push({ lat, lng });
      }
    }

    if (!stopCoords.length) {
      return NextResponse.json({ ok: true, coordinates: [] });
    }

    const fallbackCoordinates = stopCoords.map((coord) => [coord.lng, coord.lat] as [number, number]);

    if (stopCoords.length === 1) {
      return NextResponse.json({ ok: true, coordinates: fallbackCoordinates });
    }

    try {
      const directions = await fetchDrivingDirections(stopCoords);
      if (directions?.coordinates?.length) {
        const coords = directions.coordinates.map((coord) => [coord.lng, coord.lat] as [number, number]);
        return NextResponse.json({ ok: true, coordinates: coords });
      }
    } catch (error) {
      console.warn("dispatch.routes.directions", error);
    }

    return NextResponse.json({ ok: true, coordinates: fallbackCoordinates });
  } catch (error) {
    console.error("dispatch.routes.directions", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
