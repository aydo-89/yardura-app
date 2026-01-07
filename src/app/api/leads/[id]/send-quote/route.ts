import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculatePrice } from "@/lib/priceEstimator";
import { sendTransactionalEmail } from "@/lib/email";
import { getEmailConfig } from "@/lib/env";
import type {
  YardSize as PricingYardSize,
  Frequency as PricingFrequency,
} from "@/lib/priceEstimator";
import { getZoneMultiplierForZip } from "@/lib/zip-eligibility";
import { computeIntroCredits, summarizeIntroCredits } from "@/lib/billing/introCredits";
import { formatVisitsRange, getVisitsBounds } from "@/lib/utils";
import { buildQuoteEmail } from "@/lib/email/templates";
import type { PricingData } from "@/types/quote";

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
};

const formatCurrencyCompact = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  const hasCents = Math.abs(value % 100) > 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value / 100);
};

const formatCurrencyRangeCompact = (minCents: number, maxCents: number) => {
  if (minCents === maxCents) {
    return formatCurrencyCompact(minCents);
  }
  return `${formatCurrencyCompact(minCents)}–${formatCurrencyCompact(maxCents)}`;
};

const LEGACY_DIVERT_MODE_PATTERN = /^\d{1,3}%?$/;

const normalizeDivertMode = (value?: string | null) => {
  if (!value) return "none";
  const normalized = value.toLowerCase().trim();
  if (normalized === "takeaway") return "takeaway";
  if (normalized === "compost") return "compost";
  if (LEGACY_DIVERT_MODE_PATTERN.test(normalized)) return "compost";
  return normalized;
};

const RANGE_NOTE_COPY =
  "Range depends on how many service days land in a calendar month—for example, weekly plans sometimes include a fifth visit.";

const formatAreaLabel = (value: string) =>
  value
    .replace(/[_-]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const buildAddOnsFromLead = (lead: any) => {
  const addOns: Record<string, any> = {};

  if (lead?.deodorize && lead?.deodorizeMode) {
    addOns.deodorize = { mode: lead.deodorizeMode };
  }

  if (lead?.sprayDeck && lead?.sprayDeckMode) {
    addOns["spray-deck"] = { mode: lead.sprayDeckMode };
  }

  if (lead?.divertMode && lead.divertMode !== "none") {
    const normalized = normalizeDivertMode(lead.divertMode);
    if (normalized === "takeaway") {
      addOns["divert-takeaway"] = true;
    } else if (normalized === "compost") {
      addOns["divert-compost"] = true;
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
    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 },
      );
    }

    let requestedBusinessId: string | undefined;
    let requestedBillingPreference: "monthly" | "weekly" | undefined;
    try {
      const body = await req.json();
      if (body && typeof body.businessId === "string") {
        requestedBusinessId = body.businessId;
      }
      if (body && typeof body.billingPreference === "string") {
        const normalized = body.billingPreference.toLowerCase();
        if (normalized === "monthly") {
          requestedBillingPreference = "monthly";
        } else if (normalized === "weekly" || normalized === "per-visit") {
          requestedBillingPreference = "weekly";
        }
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

    const quoteReference = lead.id.length > 8
      ? lead.id.slice(-8).toUpperCase()
      : lead.id.toUpperCase();

    if (requestedBusinessId && requestedBusinessId !== lead.orgId) {
      return NextResponse.json(
        { error: "Tenant mismatch for quote delivery" },
        { status: 403 },
      );
    }

    // Update lead status to indicate quote was processed (even if email fails)
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "PROPOSAL_SENT",
      },
    });

    let pricing: any = lead.pricingBreakdown;
    if (typeof pricing === "string") {
      try {
        pricing = JSON.parse(pricing);
      } catch (error) {
        pricing = null;
      }
    }

    if (pricing && typeof pricing === "object") {
      pricing = { ...pricing };
      if (pricing.metadata && typeof pricing.metadata === "object") {
        pricing.metadata = { ...pricing.metadata };
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

    let areasToClean = (() => {
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

    areasToClean = areasToClean
      .map((area) => formatAreaLabel(area))
      .filter(Boolean)
      .slice(0, 6);

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
      const normalizedDivert = normalizeDivertMode(lead.divertMode);
      addOnHighlights.push(
        `Waste diversion (${normalizedDivert === "takeaway" ? "haul away" : "compost routing"})`,
      );
    }

    const existingBillingPreference =
      typeof pricing?.metadata?.billingPreference === "string"
        ? pricing.metadata.billingPreference.toLowerCase()
        : null;
    const normalizedBillingPreference =
      requestedBillingPreference ??
      (existingBillingPreference === "weekly" || existingBillingPreference === "monthly"
        ? (existingBillingPreference as "weekly" | "monthly")
        : null);

    if (normalizedBillingPreference) {
      const baseMetadata =
        pricing && typeof pricing === "object" && pricing.metadata
          ? (typeof pricing.metadata === "object" && pricing.metadata !== null
              ? pricing.metadata
              : {})
          : {};
      pricing = {
        ...(pricing && typeof pricing === "object" ? pricing : {}),
        metadata: {
          ...baseMetadata,
          billingPreference: normalizedBillingPreference,
        },
      };
    }

    const monthlyPrice = pricing?.monthly ?? lead.estimatedPrice ?? null;
    const perVisitPrice = pricing?.perVisit ?? null;
    const oneTimePrice = pricing?.oneTime ?? null;
    const isRecurring = lead.frequency && lead.frequency !== "onetime";

    // Calculate first visit amount based on frequency
    let firstVisitAmount = pricing?.oneTime ?? 0;
    let initialVisitLabel = "Initial Visit";

    if (isRecurring) {
      if (lead.frequency === "monthly") {
        // 50% off first visit for monthly
        firstVisitAmount += Math.round((pricing?.perVisit ?? 0) * 0.5);
        initialVisitLabel = "Initial Visit (50% off)";
      } else {
        // For weekly, bi-weekly, twice-weekly: first visit is free
        initialVisitLabel = "Initial Visit (free with service)";
      }
    } else {
      // One-time service includes per-visit charge
      firstVisitAmount += pricing?.perVisit ?? 0;
    }

    const onboardingParams = new URLSearchParams({ leadId: lead.id });
    if (lead.serviceType === "commercial") {
      onboardingParams.set("commercial", "true");
    }
    if (lead.orgId) {
      onboardingParams.set("businessId", lead.orgId);
    }
    if (normalizedBillingPreference) {
      onboardingParams.set("billingPreference", normalizedBillingPreference);
    }
    const baseSiteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.yardura.com";
    const onboardingUrl = `${baseSiteUrl}/onboarding/start?${onboardingParams.toString()}`;

    const toCents = (value?: number | null) =>
      typeof value === "number" && Number.isFinite(value) ? value : 0;

    const frequencyKey = (lead.frequency ?? "").toLowerCase();
    const isOneTime = frequencyKey === "onetime";
    const perVisitAvailable =
      lead.serviceType !== "commercial" &&
      typeof perVisitPrice === "number" &&
      ["weekly", "biweekly", "twice-weekly", "daily"].includes(frequencyKey);

    const monthlyDueTodayCents = 0;

    const perVisitAmountCents = perVisitAvailable ? toCents(perVisitPrice) : 0;
    const perVisitPrimaryAmountCents =
      frequencyKey === "twice-weekly"
        ? perVisitAmountCents * 2
        : frequencyKey === "daily"
          ? perVisitAmountCents * 5
          : perVisitAmountCents;

    const firstVisitAddOnsCents = toCents(pricing?.firstVisitAddOnsTotal);

    const perVisitDueTodayCents = 0;

    const rawInitialCleanSubtotalCents =
      typeof pricing?.initialCleanCents === "number"
        ? pricing.initialCleanCents
        : typeof pricing?.firstVisitTotalCents === "number"
          ? Math.max(0, pricing.firstVisitTotalCents - firstVisitAddOnsCents)
          : 0;

    const rawInitialCleanDiscountCents = toCents(pricing?.initialCleanDiscount);

    const initialCleanSubtotalCents =
      rawInitialCleanSubtotalCents > 0
        ? rawInitialCleanSubtotalCents
        : rawInitialCleanDiscountCents > 0
          ? rawInitialCleanDiscountCents
          : 0;

    const normalizedInitialCleanDiscountCents = Math.min(
      initialCleanSubtotalCents,
      rawInitialCleanDiscountCents,
    );

    const discountedInitialCleanCents = Math.max(
      0,
      initialCleanSubtotalCents - normalizedInitialCleanDiscountCents,
    );

    const initialVisitTotalCents =
      typeof pricing?.firstVisitTotalCents === "number" && pricing.firstVisitTotalCents > 0
        ? pricing.firstVisitTotalCents
        : discountedInitialCleanCents + firstVisitAddOnsCents;

    const resolvedBillingPreference: "monthly" | "weekly" =
      normalizedBillingPreference
        ? normalizedBillingPreference
        : perVisitAvailable
          ? "weekly"
          : "monthly";

    const billingPreferenceLabel =
      resolvedBillingPreference === "weekly"
        ? frequencyKey === "twice-weekly"
          ? "Pay per visit (two visits/week)"
          : "Pay per visit"
        : "Monthly statement (post-visit billing)";

    const showInitialBreakdown =
      initialCleanSubtotalCents > 0 ||
      normalizedInitialCleanDiscountCents > 0 ||
      firstVisitAddOnsCents > 0;

    const initialCleanStatusLabel = (() => {
      if (initialCleanSubtotalCents <= 0) {
        return null;
      }
      if (discountedInitialCleanCents <= 0) {
        return { label: "Free", tone: "free" as const };
      }
      if (normalizedInitialCleanDiscountCents > 0) {
        return {
          label: `Half off (${formatCurrency(discountedInitialCleanCents)})`,
          tone: "discount" as const,
        };
      }
      return null;
    })();

    const initialCleanBadgeColors = initialCleanStatusLabel?.tone === "discount"
      ? { bg: "rgba(243,100,91,0.16)", color: "#7C2E12" }
      : { bg: "rgba(25,180,163,0.16)", color: "#0F3C34" };

    const initialCleanStatusChipHtml = initialCleanStatusLabel
      ? `<span style="display:inline-block;margin-left:8px;padding:4px 10px;border-radius:999px;background-color:${initialCleanBadgeColors.bg};color:${initialCleanBadgeColors.color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">${initialCleanStatusLabel.label}</span>`
      : `<span style="margin-left:8px;font-size:11px;color:rgba(27,30,35,0.55);">Included</span>`;

    const renderAmountRow = (
      label: string,
      amountCents: number,
      options: {
        divider?: boolean;
        highlight?: boolean;
        noteHtml?: string;
        variant?: "credit" | "default";
      } = {},
    ) => {
      const styleParts = [
        "display:flex",
        "justify-content:space-between",
        "align-items:flex-start",
        "gap:12px",
        "font-size:12px",
        "line-height:1.55",
        "color:#475569",
        options.divider
          ? "border-top:1px dashed rgba(27,30,35,0.15);padding-top:10px;margin-top:12px;"
          : "margin:0 0 8px;",
      ]
        .filter(Boolean)
        .join(";");

      const baseColor = options.highlight ? "#1B1E23" : "#0F3C34";
      const amountColor = options.variant === "credit" ? "#B42318" : baseColor;
      const formattedAmount = formatCurrency(amountCents);
      const displayAmount =
        options.variant === "credit"
          ? `- ${formattedAmount}`
          : formattedAmount;
      const noteBlock = options.noteHtml
        ? `<div style="margin:6px 0 10px;">${options.noteHtml}</div>`
        : "";

      return `<div style="${styleParts}"><span style="font-size:12px;color:#475569;max-width:70%;">${label}</span><span style="font-size:12px;font-weight:600;color:${amountColor};white-space:nowrap;">${displayAmount}</span></div>${noteBlock}`;
    };

  const initialCleanNoteHtml = `<div style="display:flex;align-items:center;gap:8px;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(27,30,35,0.55);"><span>Value</span>${initialCleanStatusChipHtml}</div>`;

    const freeFollowUpVisits =
      frequencyKey === "twice-weekly"
        ? 1
        : frequencyKey === "daily"
          ? 4
          : 0;

    const initialValueLabelCents =
      freeFollowUpVisits > 0
        ? initialCleanSubtotalCents + perVisitAmountCents * freeFollowUpVisits
        : initialCleanSubtotalCents;

    const subtotalBeforeCreditsCents = initialValueLabelCents + firstVisitAddOnsCents;

    const hasInitialCleanCredit =
      initialCleanSubtotalCents > 0 && discountedInitialCleanCents === 0;

    const totalCreditCents =
      (hasInitialCleanCredit ? initialCleanSubtotalCents : 0) +
      perVisitAmountCents * freeFollowUpVisits;

    const creditRowLabel =
      freeFollowUpVisits > 0 ? "First week credit" : "Initial clean credit";

    const showCreditSummary = totalCreditCents > 0;

    const initialCleanHtml = initialCleanSubtotalCents > 0
      ? renderAmountRow("Initial clean", initialCleanSubtotalCents, { noteHtml: initialCleanNoteHtml })
      : "";

    const weekdayCreditsHtml =
      frequencyKey === "daily" && perVisitAmountCents > 0
        ? renderAmountRow("Weekday visits (4)", perVisitAmountCents * 4, {
            noteHtml:
              '<div style="font-size:11px;color:rgba(27,30,35,0.55);">Charged after each weekday service</div>',
          })
        : "";

    const followUpLabel =
      frequencyKey === "twice-weekly"
        ? "Follow-up visit (2nd weekly)"
        : frequencyKey === "daily"
          ? "Weekday visits (4)"
          : null;
    const followUpAmountCents =
      frequencyKey === "twice-weekly"
        ? perVisitAmountCents
        : frequencyKey === "daily"
          ? perVisitAmountCents * 4
          : 0;
    const followUpRowHtml =
      followUpLabel && followUpAmountCents > 0
        ? renderAmountRow(followUpLabel, followUpAmountCents)
        : "";

    const subtotalBeforeCreditsHtml = showCreditSummary
      ? renderAmountRow("Subtotal before credits", subtotalBeforeCreditsCents, {
          divider: true,
        })
      : "";

    const creditRowHtml = showCreditSummary
      ? renderAmountRow(creditRowLabel, totalCreditCents, {
          variant: "credit",
        })
      : "";

    const initialCleanTextLine = initialCleanSubtotalCents > 0
      ? `  Initial clean: ${formatCurrency(initialCleanSubtotalCents)} value${initialCleanStatusLabel ? ` — ${initialCleanStatusLabel.label}` : ""}`
      : null;


    const emailBillingPreference = isOneTime
      ? "one-time"
      : resolvedBillingPreference === "monthly"
        ? "monthly"
        : "per-visit";

    const quoteEmail = buildQuoteEmail({
      lead: {
        firstName: lead.firstName ?? null,
        lastName: lead.lastName ?? null,
        email: lead.email ?? null,
        submittedAt: lead.submittedAt ?? null,
        dogs: lead.dogs ?? null,
        yardSize: lead.yardSize ?? null,
        address: lead.address ?? null,
        city: lead.city ?? null,
        state: lead.state ?? null,
        zipCode: lead.zipCode ?? null,
        deodorize: lead.deodorize ?? null,
        deodorizeMode: lead.deodorizeMode ?? null,
        sprayDeck: lead.sprayDeck ?? null,
        sprayDeckMode: lead.sprayDeckMode ?? null,
        divertMode: normalizeDivertMode(lead.divertMode),
        areasToClean: lead.areasToClean ?? null,
        serviceType: lead.serviceType ?? null,
      },
      pricing: (pricing as PricingData | null) ?? null,
      quoteReference,
      frequencyKey,
      billingPreference: emailBillingPreference,
      onboardingUrl,
      siteUrl: baseSiteUrl,
    });

    const { subject, html, text } = quoteEmail;

    const recipients = [lead.email];
    const bccList = (process.env.CONTACT_TO_EMAIL || "")
      .split(",")
      .map((email) => email.trim())
      .filter(Boolean);

    const emailConfig = getEmailConfig();
    const emailDeliveryEnabled = emailConfig.provider !== "console";
    const fromEmail =
      process.env.RESEND_FROM_EMAIL ||
      emailConfig.from ||
      "InsightScoop Quotes <quotes@insightscoop.com>";

    const emailId = await sendTransactionalEmail({
      to: recipients,
      bcc: bccList.length ? bccList : undefined,
      subject,
      html,
      text,
      from: fromEmail,
    });

    // Update lead with final pricing information
    const pricingSnapshot =
      pricing && typeof pricing === "object"
        ? pricing
        : normalizedBillingPreference
          ? {
              metadata: { billingPreference: normalizedBillingPreference },
            }
          : pricing ?? lead.pricingBreakdown;

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        pricingBreakdown: pricingSnapshot,
        estimatedPrice:
          typeof monthlyPrice === "number" ? monthlyPrice : lead.estimatedPrice,
        },
      });

    const normalizedEmailId = emailDeliveryEnabled
      ? emailId ?? "queued"
      : null;

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      emailId: normalizedEmailId,
      emailEnabled: emailDeliveryEnabled,
      message: emailDeliveryEnabled
        ? undefined
        : "Quote processed successfully, but email not sent (email provider not configured)",
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
