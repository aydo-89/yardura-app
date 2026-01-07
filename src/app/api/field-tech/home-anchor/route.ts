import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getScooperAuth } from "@/lib/auth/scooper";
import { prisma } from "@/lib/prisma";
import { geocodeAddress } from "@/lib/google/maps";
import { validateAddress } from "@/lib/google/address-validation";

const schema = z.object({
  address: z.string().min(3).max(200),
  city: z.string().min(2).max(120),
  state: z.string().min(2).max(60),
  zip: z.string().min(3).max(20),
});

function coerceMetadataRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }
  return value as Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [user, profile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        address: true,
        city: true,
        zipCode: true,
      },
    }),
    prisma.scooperProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        metadata: true,
      },
    }),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
  }

  const metadata = coerceMetadataRecord(profile.metadata);
  const homeAddressInput = (metadata.homeAddressInput as {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  } | null) ?? {
    address: user?.address ?? "",
    city: user?.city ?? "",
    state: "",
    zip: user?.zipCode ?? "",
  };

  return NextResponse.json({
    homeAnchor: metadata.homeAnchor ?? null,
    homeAddressInput,
    routeCredits: typeof metadata.routeCredits === "number" ? metadata.routeCredits : 0,
    homeAnchorValidatedAt: metadata.homeAnchorValidatedAt ?? null,
    homeAnchorVerdict: metadata.homeAnchorVerdict ?? null,
    suggestions: metadata.homeAnchorSuggestions ?? [],
  });
}

export async function POST(request: NextRequest) {
  const auth = await getScooperAuth(request);
  const userId = auth?.userId;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { address, city, state, zip } = parsed.data;
  const formatted = `${address}, ${city}, ${state} ${zip}`;

  let validation;
  try {
    validation = await validateAddress({ address, city, state, zip });
    // If validation returns null (API not enabled), continue with geocoding fallback
  } catch (error) {
    console.warn("[field-tech.home-anchor] address validation error", error);
    // Don't fail - fall back to geocoding
    validation = null;
  }

  let canonicalAddress = validation?.formattedAddress ?? formatted;
  let anchorLocation = validation?.location ?? null;

  if (!anchorLocation) {
    const geocode = await geocodeAddress(canonicalAddress);
    if (geocode) {
      anchorLocation = geocode.location;
      canonicalAddress = geocode.formattedAddress ?? canonicalAddress;
    }
  }

  if (!anchorLocation) {
    return NextResponse.json(
      {
        error: "geocode_failed",
        message: "We couldn't locate that address. Double-check and try again.",
        suggestions: validation?.suggestions ?? [],
      },
      { status: 400 },
    );
  }

  const profile = await prisma.scooperProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      metadata: true,
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "scooper_profile_missing" }, { status: 404 });
  }

  const metadata = coerceMetadataRecord(profile.metadata);
  metadata.homeAnchor = {
    lat: anchorLocation.lat,
    lng: anchorLocation.lng,
    address: canonicalAddress,
  };
  if (validation) {
    metadata.homeAnchorValidatedAt = new Date().toISOString();
    metadata.homeAnchorVerdict = validation.verdict;
    metadata.homeAnchorSuggestions = validation.suggestions;
  }
  metadata.homeAddressInput = { address, city, state, zip };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        address,
        city,
        zipCode: zip,
      },
    }),
    prisma.scooperProfile.update({
      where: { id: profile.id },
      data: { metadata: metadata as any },
    }),
    prisma.scooperRoutePlan.deleteMany({ where: { scooperId: profile.id } }),
  ]);

  return NextResponse.json({
    ok: true,
    homeAnchor: metadata.homeAnchor,
    validation: validation?.verdict ?? null,
    suggestions: validation?.suggestions ?? [],
  });
}

export const runtime = "nodejs";
