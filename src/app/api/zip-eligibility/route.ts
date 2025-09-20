import { NextRequest, NextResponse } from "next/server";
import {
  checkZipEligibility,
  getZoneMultiplierForZip,
} from "@/lib/zip-eligibility";
import { resolveBusinessId } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const { zip, zipCode, businessId: bodyBusinessId } = await request.json();
    const resolvedBusinessId =
      bodyBusinessId || (await resolveBusinessId(request));
    const zipToCheck = zip || zipCode;

    if (!zipToCheck) {
      return NextResponse.json(
        { error: "ZIP code is required" },
        { status: 400 },
      );
    }

    // Use the zip-eligibility.ts function which properly uses business-config.ts
    const result = await checkZipEligibility(zipToCheck, resolvedBusinessId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("ZIP eligibility check error:", error);
    return NextResponse.json(
      { eligible: false, message: "Unable to check ZIP eligibility" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const zip = url.searchParams.get("zip") || url.searchParams.get("zipCode");
  const explicit = url.searchParams.get("businessId");
  const businessId = explicit || (await resolveBusinessId(request));
  const type = url.searchParams.get("type") || "eligibility";

  if (!zip) {
    return NextResponse.json({ error: "ZIP code required" }, { status: 400 });
  }

  if (type === "eligibility") {
    // Use the zip-eligibility.ts function which properly uses business-config.ts
    const result = await checkZipEligibility(zip, businessId);
    return NextResponse.json(result);
  } else if (type === "multiplier") {
    // Use the business-config function for zone multiplier
    const multiplier = await getZoneMultiplierForZip(zip, businessId);
    return NextResponse.json({ multiplier });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
