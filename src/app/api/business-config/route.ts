import { NextRequest, NextResponse } from "next/server";
import { getBusinessConfig } from "@/lib/business-config";
import { resolveBusinessId } from "@/lib/tenant";

// Public endpoint to fetch business configuration for client components
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const explicit = searchParams.get("businessId");
    const businessId = explicit || (await resolveBusinessId(request));
    const config = await getBusinessConfig(businessId);
    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error fetching public business config:", error);
    return NextResponse.json(
      { error: "Failed to fetch business configuration" },
      { status: 500 },
    );
  }
}
