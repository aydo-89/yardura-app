import { NextRequest } from "next/server";
import { buildToolResponse, parseToolRequest } from "../utils";

/**
 * Vapi webhook adapter for create_and_email_quote tool
 * Translates Vapi's tool call format to our internal API format
 */
export async function POST(request: NextRequest) {
  let parsed = parseToolRequest({});
  try {
    const body = await request.json();
    parsed = parseToolRequest(body);
    const { args } = parsed;

    const requiredFields = ["firstName", "email", "dogs", "yardSize", "frequency", "zipCode"];
    const missingFields = requiredFields.filter((field) => !args[field]);

    if (missingFields.length > 0) {
      return buildToolResponse(
        parsed,
        `Missing required fields: ${missingFields.join(", ")}.`,
        { status: 400 },
      );
    }

    // Call our internal quote creation API (use localhost for internal server-to-server call)
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'http://localhost:3000/api/quote'
      : `${request.nextUrl.origin}/api/quote`;
    const quoteResponse = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: args.firstName,
          lastName: args.lastName,
          email: args.email,
          phone:
            args.phone ||
            body.message?.call?.customer?.number ||
            body.call?.customer?.number,
          dogs: args.dogs,
          yardSize: args.yardSize,
          frequency: args.frequency,
          weekendUpgrade: args.weekendUpgrade || false,
          address: args.address,
          zipCode: args.zipCode,
          serviceType: args.serviceType || "residential",
          lastCleanedBucket: args.lastCleanedBucket,
          areasToClean: args.areasToClean,
          addOns: {
            deodorize: args.deodorize || false,
            deodorizeMode: args.deodorizeMode,
            divertMode: args.divertMode || "none",
          },
          // Add any other fields from the call context
          referralSource: "phone-call",
        }),
      }
    );

    if (!quoteResponse.ok) {
      const error = await quoteResponse.json().catch(() => ({}));
      return buildToolResponse(parsed, `Failed to create quote: ${error.error || "Unknown error"}. Please try again or have them email us at sales@yardura.com.`, {
        status: quoteResponse.status,
      });
    }

    const quoteData = await quoteResponse.json();

    if (!quoteData.ok || !quoteData.leadId) {
      return buildToolResponse(parsed, "I had trouble creating the quote. Please have them email sales@yardura.com and we'll send it right away.", {
        status: 500,
      });
    }

    // Now send the formatted quote email to the customer
    const sendQuoteUrl = process.env.NODE_ENV === 'production'
      ? `http://localhost:3000/api/leads/${quoteData.leadId}/send-quote`
      : `${request.nextUrl.origin}/api/leads/${quoteData.leadId}/send-quote`;
    const sendQuoteResponse = await fetch(sendQuoteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}), // The send-quote endpoint reads from the lead record
      }
    );

    if (!sendQuoteResponse.ok) {
      console.error("[vapi-tools] Failed to send quote email", await sendQuoteResponse.text());
      return buildToolResponse(parsed, `I created your quote but had trouble sending the email. Our team at sales@yardura.com will send it to ${args.email} within one business day.`, {
        status: sendQuoteResponse.status,
      });
    }

    // Format success response for Vapi
    const result = `Perfect! I've sent a detailed quote to ${args.email}. They should receive it within a few minutes with all the pricing details we discussed. Is there anything else I can help with?`;

    return buildToolResponse(parsed, result, {
      metadata: {
        leadId: quoteData.leadId,
        created: true,
      },
    });
  } catch (error) {
    console.error("[vapi-tools] Create quote error:", error);
    return buildToolResponse(parsed, "I'm having trouble sending the quote right now. Please have them email sales@yardura.com and we'll get back to them within one business day.", {
      status: 500,
    });
  }
}
