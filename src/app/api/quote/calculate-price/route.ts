import { NextRequest, NextResponse } from "next/server";
import { calculatePrice } from "@/lib/priceEstimator";

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid or empty request body" },
        { status: 400 }
      );
    }

    const {
      dogs,
      yardSize,
      frequency,
      addons,
      initialClean,
      premiumOnboarding,
      deepCleanAssessment,
      propertyType,
      address,
      lastCleanedBucket,
      lastCleanedDate,
      zoneMultiplier,
      areasToClean,
      businessId,
      weekendUpgrade,
    } = body;

    // Call the pricing calculation with business-specific config
    const result = await calculatePrice({
      dogs,
      yardSize,
      frequency,
      addons,
      initialClean,
      premiumOnboarding,
      deepCleanAssessment,
      propertyType,
      address,
      lastCleanedBucket,
      lastCleanedDate,
      zoneMultiplier,
      areasToClean,
      businessId,
      weekendUpgrade,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Price calculation API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to calculate pricing", details: errorMessage },
      { status: 500 },
    );
  }
}
