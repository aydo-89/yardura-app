import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildToolResponse, parseToolRequest } from "../utils";
import { sendTransactionalEmail } from "@/lib/email";
import { buildPaymentLinkEmail } from "@/lib/email/templates";
import twilio from "twilio";

/**
 * Vapi webhook for send_payment_link tool
 * Sends the payment setup link via SMS or email
 */
export async function POST(request: NextRequest) {
  let parsed = parseToolRequest({});
  try {
    const body = await request.json();
    parsed = parseToolRequest(body);
    const { args } = parsed;

    if (!args.leadId) {
      return buildToolResponse(
        parsed,
        "I need the lead ID to send the payment link.",
        { status: 400 },
      );
    }

    const lead = await prisma.lead.findUnique({
      where: { id: args.leadId },
    });

    if (!lead) {
      return buildToolResponse(
        parsed,
        "I couldn't find that registration. Let me help you start over.",
        { status: 404 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://www.getinsightscoop.com";
    const setupLink = `${baseUrl}/onboarding/setup?leadId=${lead.id}`;
    const preferredChannel = (args.method ?? "sms").toLowerCase();

    const sendEmail = async (reason?: string) => {
      if (!lead.email) {
        return buildToolResponse(
          parsed,
          "I can't send the link—there's no email address on file. Please collect an email or phone number and try again.",
          { status: 400 },
        );
      }



      const frequencyLabelMap: Record<string, string> = {
        weekly: "Weekly service",
        "twice-weekly": "Twice weekly service",
        daily: "Weekday service",
        biweekly: "Every other week",
        "bi-weekly": "Every other week",
        "every-other-week": "Every other week",
        monthly: "Monthly service",
        onetime: "One-time service",
        "one-time": "One-time service",
      };
      const frequencyLabel = frequencyLabelMap[lead.frequency?.toLowerCase() ?? ""] ?? "Recurring service";
      const { html: emailHtml, text: emailText } = buildPaymentLinkEmail({
        leadName: lead.firstName || lead.email || "there",
        setupUrl: setupLink,
        frequencyLabel,
      });

      await sendTransactionalEmail({
        to: [lead.email],
        subject: "Complete Your InsightScoop Setup",
        html: emailHtml,
        text: emailText,
        from: process.env.RESEND_FROM_EMAIL || "InsightScoop <notifications@yardura.com>",
      });

      const suffix = reason ? ` ${reason}` : "";
      return buildToolResponse(
        parsed,
        `Perfect! I just emailed the setup link to ${lead.email}.${suffix} Check your inbox in the next few minutes. The link is good for 7 days, and you can complete setup whenever you're ready.`,
      );
    };

    const sendSms = async () => {
      if (!lead.phone) {
        return sendEmail(" I emailed it instead because there's no phone number on file.");
      }

      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.warn("[vapi-tools] Twilio credentials missing; falling back to email");
        return sendEmail(" I emailed it instead because texting isn't configured yet.");
      }

      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN,
      );

      await twilioClient.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: lead.phone,
        body: `Hi ${lead.firstName}! Complete your InsightScoop setup here: ${setupLink}
        
Review your service details and add payment. No upfront charges—you're billed after each visit.

Questions? Reply or call 1-871-417-YARD`,
      });

      return buildToolResponse(
        parsed,
        `Great! I just texted the setup link to ${lead.phone}. They can review everything and add payment anytime in the next 7 days.`,
      );
    };

    if (preferredChannel === "sms") {
      try {
        return await sendSms();
      } catch (smsError) {
        console.warn("[vapi-tools] SMS delivery failed, falling back to email", smsError);
        return sendEmail(" The text didn't go through, so I emailed it instead.");
      }
    }

    return sendEmail();
  } catch (error) {
    console.error("[vapi-tools] Send payment link error:", error);
    return buildToolResponse(
      parsed,
      "I had trouble sending that link. Let me have our team email it to you directly. They'll reach out within an hour.",
      { status: 500 },
    );
  }
}
