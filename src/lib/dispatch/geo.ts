import crypto from "crypto";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/google/maps";
import { fetchDistanceMatrix } from "@/lib/google/maps";

interface AddressContext {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

interface CustomerContext extends AddressContext {
  id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

interface VisitContext extends AddressContext {
  id?: string | null;
  customerId?: string | null;
  metadata?: Prisma.JsonValue | null;
}

export interface VisitGeoResolution {
  latitude: number;
  longitude: number;
  source: "customer" | "snapshot" | "geocode";
  snapshotId?: string;
}

function normalizeAddressComponent(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function buildAddressString(address: AddressContext): string {
  const segments = [
    normalizeAddressComponent(address.addressLine1),
    normalizeAddressComponent(address.city),
    normalizeAddressComponent(address.state),
    normalizeAddressComponent(address.zip),
  ].filter((segment) => segment.length > 0);

  return segments.join(", ");
}

function computeAddressHash(orgId: string, address: AddressContext): string {
  const normalized = `${orgId}::${buildAddressString(address)}`;
  return crypto.createHash("sha1").update(normalized).digest("hex");
}

function extractMetadataLocation(
  metadata: Prisma.JsonValue | null | undefined,
): { latitude?: number; longitude?: number } {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const record = metadata as Record<string, unknown>;
  const latitude = typeof record.latitude === "number" ? record.latitude : undefined;
  const longitude = typeof record.longitude === "number" ? record.longitude : undefined;
  return { latitude, longitude };
}

function toGeohash(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
}

export async function ensureVisitGeoSnapshot(options: {
  orgId: string;
  customer?: CustomerContext | null;
  visit?: VisitContext | null;
}): Promise<VisitGeoResolution> {
  const { orgId, customer, visit } = options;

  const metadataCoords = extractMetadataLocation(visit?.metadata ?? null);
  if (typeof customer?.latitude === "number" && typeof customer?.longitude === "number") {
    return { latitude: customer.latitude, longitude: customer.longitude, source: "customer" };
  }

  if (typeof metadataCoords.latitude === "number" && typeof metadataCoords.longitude === "number") {
    return {
      latitude: metadataCoords.latitude,
      longitude: metadataCoords.longitude,
      source: "customer",
    };
  }

  const address: AddressContext = {
    addressLine1: visit?.addressLine1 ?? customer?.addressLine1,
    city: visit?.city ?? customer?.city,
    state: visit?.state ?? customer?.state,
    zip: visit?.zip ?? customer?.zip,
  };

  if (!address.addressLine1 || !address.city) {
    throw new Error("Unable to resolve coordinates: missing address data");
  }

  const addressHash = computeAddressHash(orgId, address);

  const existingSnapshot = await prisma.visitGeoSnapshot.findUnique({
    where: {
      orgId_addressHash: {
        orgId,
        addressHash,
      },
    },
  });

  if (existingSnapshot) {
    if (visit?.id && !existingSnapshot.serviceVisitId) {
      await prisma.visitGeoSnapshot.update({
        where: { id: existingSnapshot.id },
        data: {
          serviceVisitId: visit.id,
          customerId: existingSnapshot.customerId ?? visit.customerId ?? customer?.id ?? undefined,
        },
      });
    }

    return {
      latitude: existingSnapshot.latitude,
      longitude: existingSnapshot.longitude,
      source: "snapshot",
      snapshotId: existingSnapshot.id,
    };
  }

  const waypoint = buildAddressString(address);
  const geocode = waypoint
    ? await geocodeAddress(waypoint)
    : null;

  if (!geocode) {
    throw new Error(`Unable to geocode address: ${waypoint}`);
  }

  const snapshot = await prisma.visitGeoSnapshot.upsert({
    where: {
      orgId_addressHash: {
        orgId,
        addressHash,
      },
    },
    update: {
      latitude: geocode.location.lat,
      longitude: geocode.location.lng,
      geohash: toGeohash(geocode.location.lat, geocode.location.lng),
      serviceVisitId: visit?.id ?? undefined,
      customerId: visit?.customerId ?? customer?.id ?? undefined,
      metadata: {
        ...(geocode.placeId ? { placeId: geocode.placeId } : {}),
      },
    },
    create: {
      orgId,
      addressLine1: address.addressLine1 ?? undefined,
      city: address.city ?? undefined,
      state: address.state ?? undefined,
      zip: address.zip ?? undefined,
      latitude: geocode.location.lat,
      longitude: geocode.location.lng,
      geohash: toGeohash(geocode.location.lat, geocode.location.lng),
      serviceVisitId: visit?.id ?? undefined,
      customerId: visit?.customerId ?? customer?.id ?? undefined,
      addressHash,
      source: "geocode",
      metadata: {
        ...(geocode.placeId ? { placeId: geocode.placeId } : {}),
      },
    },
  });

  if (customer?.id) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        latitude: geocode.location.lat,
        longitude: geocode.location.lng,
      },
    });
  }

  return {
    latitude: snapshot.latitude,
    longitude: snapshot.longitude,
    source: snapshot.source === "snapshot" ? "snapshot" : "geocode",
    snapshotId: snapshot.id,
  };
}

export async function warmDistanceMatrixForCoordinates(
  origins: Array<{ latitude: number; longitude: number }>,
  destinations: Array<{ latitude: number; longitude: number }> = origins,
) {
  // Distance Matrix responses can no longer be cached, so pre-warming is a no-op.
  if (!origins.length || !destinations.length) {
    return;
  }
}
