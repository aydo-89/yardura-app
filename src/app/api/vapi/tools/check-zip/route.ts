import { NextRequest } from "next/server";
import { checkZipEligibility } from "@/lib/zip-eligibility";
import { buildToolResponse, parseToolRequest } from "../utils";
import { buildTileMessaging } from "@/lib/marketplace";

/**
 * Vapi webhook adapter for check_service_area tool
 * Verifies if a ZIP code is in the service area
 */
export async function POST(request: NextRequest) {
  let parsed = parseToolRequest({});
  try {
    const body = await request.json();
    parsed = parseToolRequest(body);
    const { args } = parsed;

    if (!args.zipCode) {
      return buildToolResponse(parsed, "I need a ZIP code to check if we service that area.", {
        status: 400,
      });
    }

    // Check ZIP eligibility
    const eligibility = await checkZipEligibility(String(args.zipCode), "yardura");

    const messaging = buildTileMessaging(eligibility);

    const detail = messaging.detail
      ? ` ${messaging.detail}`
      : "";

    const followUp = eligibility.eligible
      ? " Ready for me to get your quote started?"
      : " Want me to add you to the waitlist so you're first to know when we launch there?";

    const result = `${messaging.headline}${detail}${followUp}`.trim();

    return buildToolResponse(parsed, result, {
      metadata: { eligibility, messaging },
    });
  } catch (error) {
    console.error("[vapi-tools] Check ZIP error:", error);
    return buildToolResponse(parsed, "I'm having trouble checking that ZIP code right now. Let me connect you with our team at sales@yardura.com to verify service availability.", {
      status: 500,
    });
  }
}
