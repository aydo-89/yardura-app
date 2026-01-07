import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildToolResponse, parseToolRequest } from "../utils";

/**
 * Vapi webhook for collect_onboarding_details tool
 * Collects comprehensive onboarding information to create/update a lead
 */
export async function POST(request: NextRequest) {
  let parsed = parseToolRequest({});
  try {
    const body = await request.json();
    parsed = parseToolRequest(body);
    const { args } = parsed;

    const requiredFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "zipCode",
      "dogs",
      "yardSize",
      "frequency",
    ];
    const missing = requiredFields.filter((f) => !args[f]);
    if (missing.length > 0) {
      return buildToolResponse(
        parsed,
        `Missing required fields: ${missing.join(", ")}. Please collect these first.`
      );
    }

    // Use default Yardura org
    const defaultOrg = await prisma.org.findUnique({
      where: { slug: "yardura" },
    });
    
    if (!defaultOrg) {
      throw new Error("Default organization 'yardura' not found");
    }

    const leadData: any = {
      orgId: defaultOrg.id,
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
      phone: args.phone,
      zipCode: args.zipCode,
      dogs: args.dogs,
      yardSize: args.yardSize,
      frequency: args.frequency,
      status: "CONTACTED",
    };

    if (args.address) {
      leadData.address = args.address;
    }

    if (args.preferredStartDate) {
      leadData.preferredStartDate = new Date(args.preferredStartDate);
    }

    if (args.preferredServiceDay) {
      leadData.preferredServiceDay = args.preferredServiceDay;
    }

    if (args.preferredTimeWindow) {
      leadData.preferredTimeWindow = args.preferredTimeWindow;
    }

    if (args.lastCleanedBucket) {
      leadData.lastCleanedBucket = args.lastCleanedBucket;
    }

    // Handle add-ons
    if (args.deodorize !== undefined) {
      leadData.deodorize = args.deodorize;
    }
    if (args.deodorizeMode) {
      leadData.deodorizeMode = args.deodorizeMode;
    }
    if (args.divertMode) {
      leadData.divertMode = args.divertMode;
    } else {
      leadData.divertMode = "takeaway";
    }

    // Handle areas to clean
    if (args.areasToClean) {
      leadData.areasToClean = typeof args.areasToClean === "object" 
        ? JSON.stringify(args.areasToClean) 
        : args.areasToClean;
    }

    if (args.specialInstructions) {
      leadData.specialInstructions = args.specialInstructions;
    }

    const lead = await prisma.lead.create({
      data: leadData,
    });

    console.log("[vapi-tools] Lead created:", {
      leadId: lead.id,
      email: lead.email,
    });

    const baseUrl = "https://www.getinsightscoop.com";
    const setupLink = `${baseUrl}/onboarding/setup?leadId=${lead.id}`;

    return buildToolResponse(
      parsed,
      `Perfect! I've captured all your details. Your setup link is ready: ${setupLink}
      
This link will let you review everything, add your payment method, and finalize your service.`
    );
  } catch (error) {
    console.error("[vapi-tools] Error collecting onboarding details:", error);
    return buildToolResponse(
      parsed,
      "I'm having trouble saving your information. Please try again or call us at 612-581-9812.",
      { status: 500 }
    );
  }
}
