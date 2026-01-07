import { NextRequest } from "next/server";
import { buildToolResponse, parseToolRequest } from "../utils";

/**
 * Vapi webhook adapter for calculate_residential_quote tool
 * Translates Vapi's tool call format to our internal API format
 * Handles add-ons and FREE initial clean promotions
 */
export async function POST(request: NextRequest) {
  let parsed = parseToolRequest({});
  try {
    const body = await request.json();
    parsed = parseToolRequest(body);
    const { args } = parsed;

    const missingFields = ["dogs", "yardSize", "frequency"].filter(
      (field) => args[field] === undefined || args[field] === null,
    );

    if (missingFields.length > 0) {
      const message = `Missing required fields: ${missingFields.join(", ")}.`;
      return buildToolResponse(parsed, message, { status: 400 });
    }

    // Build add-ons object from arguments
    const addOns: any = {};
    const normalizedFrequency =
      typeof args.frequency === "string"
        ? args.frequency.toLowerCase()
        : "";
    const defaultDeodorizeMode =
      normalizedFrequency === "onetime" || normalizedFrequency === "one-time"
        ? "first-visit"
        : "each-visit";
    if (args.deodorize) {
      const requestedMode =
        typeof args.deodorizeMode === "string"
          ? args.deodorizeMode.toLowerCase()
          : undefined;
      const sanitizedMode =
        defaultDeodorizeMode === "first-visit"
          ? "first-visit"
          : requestedMode === "first-visit" || requestedMode === "one-time"
            ? "each-visit"
            : "each-visit";
      addOns.deodorize = true;
      addOns.deodorizeMode = sanitizedMode;
    }
    if (args.sprayDeck) {
      addOns.sprayDeck = true;
      addOns.sprayDeckMode = args.sprayDeckMode || "each-visit";
    }
    if (args.divertMode && args.divertMode !== "none") {
      addOns.divertMode = args.divertMode;
    }

    // Call our internal pricing API using localhost to avoid SSL issues
    // Use localhost for internal calls to avoid SSL handshake errors
    const baseUrl = 'http://localhost:3000';
    
    const estimateResponse = await fetch(
      `${baseUrl}/api/quote/estimate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dogs: args.dogs,
          yardSize: args.yardSize,
          frequency: args.frequency,
          addOns,
          lastCleanedBucket: args.lastCleanedBucket,
          weekendUpgrade: args.weekendUpgrade || false,
        }),
      }
    );

    if (!estimateResponse.ok) {
      const error = await estimateResponse.json().catch(() => ({}));
      const message = `Failed to calculate price: ${error.error || "Unknown error"}`;
      return buildToolResponse(parsed, message, { status: estimateResponse.status });
    }

    const pricing = await estimateResponse.json();
    const freq = args.frequency.toLowerCase();

    // Format response for Vapi with FREE initial clean messaging
    const monthlyPrice = (pricing.projectedMonthlyCents / 100).toFixed(2);
    const perVisitPrice = (pricing.perVisitCents / 100).toFixed(2);
    const initialCleanPrice = (pricing.initialCleanCents / 100).toFixed(2);
    const perVisitCents = Number(pricing.perVisitCents ?? 0);
    const initialCleanCents = Number(pricing.initialCleanCents ?? 0);
    const freeFollowUpVisits =
      freq === "twice-weekly"
        ? 1
        : freq === "daily"
          ? 4
          : 0;
    const firstWeekCreditCents =
      initialCleanCents + perVisitCents * freeFollowUpVisits;
    const firstWeekCredit = (firstWeekCreditCents / 100).toFixed(2);

    // Build add-ons description
    let addOnsDesc = "";
    const addOnsList = [];
    
    if (args.deodorize) {
      const mode = addOns.deodorizeMode || defaultDeodorizeMode;
      const modeText = mode === "each-visit" ? "every visit" : "the kickoff visit";
      addOnsList.push(`deodorizing spray (${modeText})`);
    }
    if (args.sprayDeck) {
      const mode = args.sprayDeckMode || "each-visit";
      const modeText = mode === "each-visit" ? "every visit" : mode === "every-other" ? "every other visit" : "first visit only";
      addOnsList.push(`deck/patio spray (${modeText})`);
    }
    if (args.divertMode && args.divertMode !== "none") {
      const divertText = args.divertMode === "takeaway"
        ? "waste takeaway (all waste removed offsite)"
        : "compost routing";
      addOnsList.push(divertText);
    }
    
    if (addOnsList.length > 0) {
      addOnsDesc = " This includes " + addOnsList.join(", ") + ".";
    }

    let result = "";

    if (freq === "onetime" || freq === "one-time") {
      // One-time service
      result = `For a one-time service, the total is $${perVisitPrice}.${addOnsDesc}`;
    } else if (freq === "monthly") {
      // Monthly gets 50% off initial clean
      const monthlyRate = (pricing.projectedMonthlyCents / 100).toFixed(2);
      const discountedInitial = (pricing.initialCleanCents / 200).toFixed(2); // 50% off
      result = `The pricing is $${monthlyRate} per month for monthly service.${addOnsDesc} `;
      result += `As a welcome offer, your initial cleanup is 50% off at just $${discountedInitial} (regular $${initialCleanPrice}). `;
      result += `After that, it's $${monthlyRate} per month.`;
    } else if (freq === "twice-weekly" || freq === "daily") {
      const hasWeekends = args.weekendUpgrade === true;
      const cadenceLabel =
        freq === "daily" 
          ? (hasWeekends ? "daily (Mon–Sun) service" : "daily (Mon–Fri) service")
          : "twice-weekly service";
      const freeWeekDescription =
        freq === "twice-weekly"
          ? "your initial cleanup and first follow-up visit"
          : hasWeekends
            ? "your initial cleanup plus all visits in your first week, including weekends"
            : "your initial cleanup plus the first four weekday visits";

      result = `The pricing is $${monthlyPrice} per month for ${pricing.visitsPerMonth} visits (${cadenceLabel}), which is $${perVisitPrice} per visit.${addOnsDesc} `;
      result += `As a welcome offer, your ENTIRE FIRST WEEK is FREE! That covers ${freeWeekDescription}—a $${firstWeekCredit} value. `;
      result += `After that, it's just $${monthlyPrice} per month.`;
    } else {
      // Weekly and biweekly get FREE initial clean
      result = `The pricing is $${monthlyPrice} per month for ${pricing.visitsPerMonth} visits (${args.frequency}), which is $${perVisitPrice} per visit.${addOnsDesc} `;
      result += `Plus, your initial cleanup is completely FREE—a $${initialCleanPrice} value! `;
      result += `That's right, your first visit to get your yard in great shape is on us.`;
    }

    return buildToolResponse(parsed, result, {
      metadata: { pricing },
    });
  } catch (error) {
    console.error("[vapi-tools] Quote estimate error:", error);
    return buildToolResponse(parsed, "I'm having trouble calculating the price right now. Please try again shortly or email sales@yardura.com.", {
      status: 500,
    });
  }
}
