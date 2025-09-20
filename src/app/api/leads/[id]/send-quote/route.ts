import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { calculatePrice } from "@/lib/priceEstimator";
import type {
  YardSize as PricingYardSize,
  Frequency as PricingFrequency,
} from "@/lib/priceEstimator";
import { getZoneMultiplierForZip } from "@/lib/zip-eligibility";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

const buildAddOnsFromLead = (lead: any) => {
  const addOns: Record<string, any> = {};

  if (lead?.deodorize && lead?.deodorizeMode) {
    addOns.deodorize = { mode: lead.deodorizeMode };
  }

  if (lead?.sprayDeck && lead?.sprayDeckMode) {
    addOns["spray-deck"] = { mode: lead.sprayDeckMode };
  }

  if (lead?.divertMode && lead.divertMode !== "none") {
    if (lead.divertMode === "takeaway") {
      addOns["divert-takeaway"] = true;
    } else if (lead.divertMode === "25") {
      addOns["divert-25"] = true;
    } else if (lead.divertMode === "50") {
      addOns["divert-50"] = true;
    } else if (lead.divertMode === "100") {
      addOns["divert-100"] = true;
    }
  }

  return addOns;
};

const asPricingYardSize = (
  value: string | null | undefined,
): PricingYardSize | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const allowed: PricingYardSize[] = ["small", "medium", "large", "xl"];
  return allowed.includes(normalized as PricingYardSize)
    ? (normalized as PricingYardSize)
    : null;
};

const asPricingFrequency = (
  value: string | null | undefined,
): PricingFrequency | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const allowed: PricingFrequency[] = [
    "weekly",
    "biweekly",
    "twice-weekly",
    "monthly",
    "onetime",
  ];
  return allowed.includes(normalized as PricingFrequency)
    ? (normalized as PricingFrequency)
    : null;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!resend) {
      return NextResponse.json(
        { error: "Email service is not configured. Set RESEND_API_KEY." },
        { status: 503 },
      );
    }

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 },
      );
    }

    let requestedBusinessId: string | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.businessId === "string") {
        requestedBusinessId = body.businessId;
      }
    } catch (error) {
      // Ignore JSON parse errors for empty bodies
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        orgId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        serviceType: true,
        dogs: true,
        yardSize: true,
        frequency: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        deodorize: true,
        deodorizeMode: true,
        sprayDeck: true,
        sprayDeckMode: true,
        divertMode: true,
        areasToClean: true,
        lastCleanedBucket: true,
        lastCleanedDate: true,
        daysSinceLastCleanup: true,
        initialClean: true,
        specialInstructions: true,
        referralSource: true,
        preferredContactMethod: true,
        submittedAt: true,
        estimatedPrice: true,
        pricingBreakdown: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (requestedBusinessId && requestedBusinessId !== lead.orgId) {
      return NextResponse.json(
        { error: "Tenant mismatch for quote delivery" },
        { status: 403 },
      );
    }

    let pricing: any = lead.pricingBreakdown;
    if (typeof pricing === "string") {
      try {
        pricing = JSON.parse(pricing);
      } catch (error) {
        pricing = null;
      }
    }

    // Recalculate pricing when a snapshot isn't stored
    const yardSizeForPricing = asPricingYardSize(lead.yardSize ?? undefined);
    const frequencyForPricing = asPricingFrequency(lead.frequency ?? undefined);

    if (!pricing && lead.dogs && yardSizeForPricing && frequencyForPricing) {
      let zoneMultiplier = 1.0;
      if (lead.zipCode) {
        try {
          zoneMultiplier = await getZoneMultiplierForZip(
            lead.zipCode,
            lead.orgId,
          );
        } catch (error) {
          console.warn("Falling back to default zone multiplier", error);
        }
      }

      try {
        pricing = await calculatePrice({
          dogs: lead.dogs,
          yardSize: yardSizeForPricing,
          frequency: frequencyForPricing,
          addons: buildAddOnsFromLead(lead),
          address: lead.address ?? undefined,
          propertyType:
            lead.serviceType === "commercial" ? "commercial" : "residential",
          lastCleanedBucket: lead.lastCleanedBucket ?? undefined,
          lastCleanedDate: lead.lastCleanedDate
            ? lead.lastCleanedDate.toISOString()
            : undefined,
          deepCleanAssessment: lead.daysSinceLastCleanup
            ? { daysSinceLastCleanup: lead.daysSinceLastCleanup }
            : undefined,
          initialClean: Boolean(lead.initialClean),
          zoneMultiplier,
          businessId: lead.orgId,
        });
      } catch (error) {
        console.warn("Unable to recompute pricing for lead", leadId, error);
      }
    }

    if (!lead.email) {
      return NextResponse.json(
        { error: "Lead is missing an email address" },
        { status: 400 },
      );
    }

    const fullName = [lead.firstName, lead.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const greetingName = fullName || "there";
    const addressLine = [lead.address, lead.city, lead.state, lead.zipCode]
      .filter(Boolean)
      .join(", ");

    const frequencyLabel = lead.frequency
      ? lead.frequency.replace("-", " ")
      : lead.serviceType === "commercial"
        ? "custom schedule"
        : "weekly";

    const areasToClean = (() => {
      if (!lead.areasToClean) return [] as string[];
      if (typeof lead.areasToClean === "string") {
        try {
          const parsed = JSON.parse(lead.areasToClean);
          return Object.entries(parsed)
            .filter(([_, value]) => Boolean(value))
            .map(([key]) => key)
            .slice(0, 6);
        } catch (error) {
          return [];
        }
      }

      if (typeof lead.areasToClean === "object" && lead.areasToClean !== null) {
        return Object.entries(lead.areasToClean as Record<string, unknown>)
          .filter(([_, value]) => Boolean(value))
          .map(([key]) => key)
          .slice(0, 6);
      }

      return [] as string[];
    })();

    const addOnHighlights: string[] = [];
    if (lead.deodorize) {
      addOnHighlights.push(`Deodorize (${lead.deodorizeMode || "each visit"})`);
    }
    if (lead.sprayDeck) {
      addOnHighlights.push(
        `Deck Spray (${lead.sprayDeckMode || "each visit"})`,
      );
    }
    if (lead.divertMode && lead.divertMode !== "none") {
      addOnHighlights.push(
        `Waste diversion (${lead.divertMode === "takeaway" ? "takeaway" : `${lead.divertMode}%`})`,
      );
    }

    const monthlyPrice = pricing?.monthly ?? lead.estimatedPrice ?? null;
    const perVisitPrice = pricing?.perVisit ?? null;
    const oneTimePrice = pricing?.oneTime ?? null;
    const isRecurring = lead.frequency && lead.frequency !== "onetime";
    const initialVisitLabel = isRecurring
      ? "Initial Visit (waived with recurring service)"
      : "Initial Visit";

    const onboardingParams = new URLSearchParams({ leadId: lead.id });
    if (lead.serviceType === "commercial") {
      onboardingParams.set("commercial", "true");
    }
    if (lead.orgId) {
      onboardingParams.set("businessId", lead.orgId);
    }
    const baseSiteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.yardura.com";
    const onboardingUrl = `${baseSiteUrl}/onboarding/start?${onboardingParams.toString()}`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(120deg, #0d9488, #2563eb); padding: 32px; border-radius: 18px 18px 0 0; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 26px;">Your Yardura Quote is Ready</h1>
          <p style="margin: 12px 0 0; font-size: 16px;">Thanks for exploring cleaner, healthier outdoor spaces with us.</p>
        </div>
        <div style="background: #ffffff; padding: 32px; border-radius: 0 0 18px 18px; box-shadow: 0 15px 30px rgba(15, 23, 42, 0.08);">
          <p style="font-size: 16px; line-height: 1.6;">Hi ${greetingName},</p>
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
            Here's a quick summary of your quote. When you're ready, you can convert this
            into a full service plan in just a few clicks.
          </p>

          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px; font-size: 18px; color: #0f172a;">Service Snapshot</h2>
            <ul style="padding-left: 20px; margin: 0; font-size: 15px; line-height: 1.8;">
              <li><strong>Service type:</strong> ${lead.serviceType === "commercial" ? "Commercial" : "Residential"} ${lead.initialClean ? "(includes initial deep clean)" : ""}</li>
              <li><strong>Schedule:</strong> ${frequencyLabel}</li>
              ${lead.dogs ? `<li><strong>Dogs:</strong> ${lead.dogs}</li>` : ""}
              ${lead.yardSize ? `<li><strong>Yard size:</strong> ${lead.yardSize}</li>` : ""}
              ${areasToClean.length ? `<li><strong>Areas to clean:</strong> ${areasToClean.join(", ")}</li>` : ""}
              ${addOnHighlights.length ? `<li><strong>Add-ons:</strong> ${addOnHighlights.join(", ")}</li>` : ""}
              ${addressLine ? `<li><strong>Service address:</strong> ${addressLine}</li>` : ""}
            </ul>
          </div>

          <div style="background: #ecfdf5; border: 1px solid #d1fae5; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px; font-size: 18px; color: #047857;">Pricing Overview</h2>
            <p style="margin: 0 0 12px; font-size: 15px; color: #065f46;">
              ${
                lead.frequency === "onetime"
                  ? "One-time premium cleanse - includes waste removal and deodorize treatments"
                  : "Recurring wellness service - includes pet waste removal, wellness insights, and photo confirmation"
              }
            </p>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px;">
              <div>
                <p style="margin: 0; font-size: 13px; text-transform: uppercase; color: #0f172a; letter-spacing: 0.05em;">Monthly</p>
                <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #0f172a;">${formatCurrency(monthlyPrice)}</p>
              </div>
              <div>
                <p style="margin: 0; font-size: 13px; text-transform: uppercase; color: #334155; letter-spacing: 0.05em;">Per Visit</p>
                <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #0f172a;">${formatCurrency(perVisitPrice)}</p>
              </div>
              <div>
                <p style="margin: 0; font-size: 13px; text-transform: uppercase; color: #334155; letter-spacing: 0.05em;">${initialVisitLabel}</p>
                <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #0f172a;">${formatCurrency(pricing?.initialClean ?? oneTimePrice)}</p>
              </div>
            </div>
            ${isRecurring ? '<p style="margin: 12px 0 0; font-size: 13px; color: #0f172a;">Stay on weekly, every-other-week, or twice-weekly service and this initial visit fee is waived — your first invoice will only include the recurring rate.</p>' : ""}
          </div>

          <div style="background: #eff6ff; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
            <h2 style="margin: 0 0 16px; font-size: 18px; color: #1d4ed8;">Next Steps</h2>
            <ol style="padding-left: 20px; margin: 0; font-size: 15px; line-height: 1.8;">
              <li>Reply to this email with any adjustments you'd like.</li>
              <li>When you're ready, create your account to lock in pricing and schedule service.</li>
              <li>Our team will confirm your start date and share visit updates after each service.</li>
            </ol>
          </div>

          <div style="text-align: center; margin-bottom: 32px;">
            <a
              href="${onboardingUrl}"
              style="display: inline-block; padding: 14px 28px; background: #2563eb; color: white; text-decoration: none; border-radius: 999px; font-weight: 600;"
            >
              Create Account & Schedule Service
            </a>
          </div>

          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            Prefer a call? Reach us at <a href="tel:1-888-915-9273" style="color: #2563eb; text-decoration: none;">1-888-915-YARD</a>.
            We're happy to walk through the plan or set everything up for you.
          </p>

          <p style="font-size: 12px; color: #94a3b8; margin-top: 32px;">
            Quote Reference: ${lead.id} - Submitted ${lead.submittedAt.toLocaleString(
              "en-US",
              {
                month: "short",
                day: "numeric",
                year: "numeric",
              },
            )}
          </p>
        </div>
      </div>
    `;

    const text = `Hi ${greetingName},

Here is your Yardura quote summary:

Service type: ${lead.serviceType === "commercial" ? "Commercial" : "Residential"}
Schedule: ${frequencyLabel}
${lead.dogs ? `Dogs: ${lead.dogs}\n` : ""}${lead.yardSize ? `Yard size: ${lead.yardSize}\n` : ""}${areasToClean.length ? `Areas to clean: ${areasToClean.join(", ")}\n` : ""}${addOnHighlights.length ? `Add-ons: ${addOnHighlights.join(", ")}\n` : ""}
Monthly estimate: ${formatCurrency(monthlyPrice)}
Per-visit estimate: ${formatCurrency(perVisitPrice)}
Initial visit${isRecurring ? " (waived with recurring service)" : ""}: ${formatCurrency(pricing?.initialClean ?? oneTimePrice)}
${isRecurring ? "Initial visit fee is waived when you stay on weekly, every-other-week, or twice-weekly service." : ""}

Ready to get started? Create your account to confirm service: ${onboardingUrl}

Questions? Call us at 1-888-915-YARD (9273) or reply to this email.

-- The Yardura Team`;

    const recipients = [lead.email];
    const bccList = (process.env.CONTACT_TO_EMAIL || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    const sendResult = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL || "Yardura Quotes <quotes@yardura.com>",
      to: recipients,
      bcc: bccList.length ? bccList : undefined,
      subject: "Your Yardura Service Quote",
      html,
      text,
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "PROPOSAL_SENT",
        pricingBreakdown: pricing ?? lead.pricingBreakdown,
        estimatedPrice:
          typeof monthlyPrice === "number" ? monthlyPrice : lead.estimatedPrice,
      },
    });

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      emailId: sendResult.data?.id ?? null,
    });
  } catch (error) {
    console.error("Failed to send quote email:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to send quote email: ${message}` },
      { status: 500 },
    );
  }
}
