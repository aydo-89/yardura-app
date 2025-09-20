import { NextRequest, NextResponse } from "next/server";
import { checkZipEligibility } from "@/lib/zip-eligibility";

export async function POST(request: NextRequest) {
  try {
    const { zipCode, businessId } = await request.json();

    if (!zipCode || !businessId) {
      return NextResponse.json(
        { error: "ZIP code and business ID are required" },
        { status: 400 },
      );
    }

    const result = await checkZipEligibility(zipCode, businessId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("ZIP eligibility check error:", error);
    return NextResponse.json(
      { error: "Failed to check ZIP eligibility" },
      { status: 500 },
    );
  }
}
