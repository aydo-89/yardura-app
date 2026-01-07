import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildToolResponse, parseToolRequest } from "../utils";

/**
 * Vapi webhook adapter for add_to_waitlist tool
 * Adds a customer to the expansion waitlist for out-of-area ZIP codes
 */
export async function POST(request: NextRequest) {
  let parsed = parseToolRequest({});
  try {
    const body = await request.json();
    parsed = parseToolRequest(body);
    const { args } = parsed;

    if (!args.email || !args.zipCode) {
      return buildToolResponse(
        parsed,
        "I need an email address and ZIP code to add you to the waitlist.",
        { status: 400 },
      );
    }

    // Create a lead record marked as out-of-area
    await prisma.lead.create({
      data: {
        orgId: "yardura",
        firstName: args.firstName || "Waitlist",
        email: args.email,
        phone:
          args.phone ||
          body.message?.call?.customer?.number ||
          body.call?.customer?.number,
        zipCode: args.zipCode,
        serviceType: "residential",
        status: "ARCHIVED",
        referralSource: "phone-call-waitlist",
        specialInstructions: `Out of service area - interested in expansion to ${args.zipCode}`,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("x-real-ip") ||
          "unknown",
        userAgent: request.headers.get("user-agent"),
      },
    });

    const result = `Perfect! I've added ${args.email} to our expansion waitlist for ${args.zipCode}. We'll reach out as soon as we expand to your area. Thank you for your interest in InsightScoop!`;

    return buildToolResponse(parsed, result);
  } catch (error) {
    console.error("[vapi-tools] Waitlist error:", error);
    return buildToolResponse(parsed, "I had trouble adding you to the waitlist. Please email sales@yardura.com and we'll make sure you're notified when we expand to your area.", {
      status: 500,
    });
  }
}


