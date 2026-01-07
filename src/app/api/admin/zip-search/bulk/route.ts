import { NextRequest, NextResponse } from "next/server";

import { checkZipEligibility } from "@/lib/zip-eligibility";

interface BulkZipRequest {
  zipCodes?: string[];
  businessId?: string;
}

interface BulkZipResponseItem {
  zipCode: string;
  result: Awaited<ReturnType<typeof checkZipEligibility>> | null;
  error?: string;
}

const DEFAULT_BUSINESS_ID = "yardura";

export async function POST(request: NextRequest) {
  try {
    const { zipCodes, businessId }: BulkZipRequest = await request.json();

    if (!zipCodes || !Array.isArray(zipCodes) || zipCodes.length === 0) {
      return NextResponse.json(
        { error: "zipCodes array is required" },
        { status: 400 },
      );
    }

    const orgId = businessId || DEFAULT_BUSINESS_ID;

    const results = await Promise.allSettled(
      zipCodes.map(async (zipCode): Promise<BulkZipResponseItem> => {
        if (typeof zipCode !== "string" || !zipCode.trim()) {
          return {
            zipCode: String(zipCode ?? ""),
            result: null,
            error: "Invalid ZIP code",
          };
        }

        try {
          const eligibility = await checkZipEligibility(zipCode.trim(), orgId);
          return {
            zipCode: zipCode.trim(),
            result: eligibility,
          };
        } catch (error) {
          console.error("Bulk ZIP eligibility error", {
            zipCode,
            orgId,
            error,
          });
          return {
            zipCode: zipCode.trim(),
            result: null,
            error: "Failed to resolve eligibility",
          };
        }
      }),
    );

    const payload: BulkZipResponseItem[] = results.map((settled, index) => {
      if (settled.status === "fulfilled") {
        return settled.value;
      }

      console.error("Bulk ZIP eligibility rejected", {
        zipCode: zipCodes[index],
        orgId,
        error: settled.reason,
      });

      return {
        zipCode: String(zipCodes[index] ?? ""),
        result: null,
        error: "Failed to resolve eligibility",
      };
    });

    return NextResponse.json({
      businessId: orgId,
      count: payload.length,
      results: payload,
    });
  } catch (error) {
    console.error("Bulk ZIP eligibility route error", error);
    return NextResponse.json(
      { error: "Failed to resolve ZIP eligibility" },
      { status: 500 },
    );
  }
}
