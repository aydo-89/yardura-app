import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeGetServerSession, authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getBusinessConfig, getZoneMultiplierForZip } from "@/lib/business-config";
import { visitsPerMonth, type Frequency } from "@/lib/priceEstimator";

/**
 * POST /api/subscription/add-on
 * 
 * Adds or updates a subscription add-on for the current user.
 * Currently supports:
 * - compost: Compost routing
 * - deodorize: Deodorizing service
 * 
 * This updates the Lead record and Job record, and optionally
 * updates the Stripe subscription if applicable.
 */

// Add-on type to divertMode mapping
const COMPOST_LEVELS: Record<string, string> = {
  compost: "compost",
};

// Add-on IDs in business config
const COMPOST_ADDON_IDS: Record<string, string> = {
  compost: "divert-compost",
};

const DIVERT_ADDON_IDS: Record<string, string> = {
  takeaway: "divert-takeaway",
  compost: "divert-compost",
};

const LEGACY_LEVEL_PATTERN = /^\d{1,3}%?$/;

const normalizeDivertMode = (value?: string | null) => {
  if (!value) return "none";
  const normalized = value.toLowerCase().trim();
  if (normalized === "takeaway") return "takeaway";
  if (normalized === "compost") return "compost";
  if (LEGACY_LEVEL_PATTERN.test(normalized)) return "compost";
  return normalized;
};

function normalizeFrequency(value?: string | null): Frequency {
  if (!value) return "weekly";
  const normalized = value.toLowerCase().replace(/_/g, "-");
  if (normalized === "bi-weekly") return "biweekly";
  if (normalized === "one-time" || normalized === "one time") return "onetime";
  if (normalized === "twice-weekly") return "twice-weekly";
  if (normalized === "daily") return "daily";
  if (normalized === "monthly") return "monthly";
  return "weekly";
}

export async function POST(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { addOn, level } = body;

    if (!addOn || !level) {
      return NextResponse.json(
        { error: "Missing addOn or level" },
        { status: 400 }
      );
    }

    // Currently only support composting add-on
    if (addOn !== "compost") {
      return NextResponse.json(
        { error: "Unsupported add-on type" },
        { status: 400 }
      );
    }

    const normalizedLevel =
      typeof level === "string" ? level.toLowerCase().trim() : "compost";
    const compostLevel =
      COMPOST_LEVELS[normalizedLevel] || (LEGACY_LEVEL_PATTERN.test(normalizedLevel) ? "compost" : undefined);

    if (!compostLevel) {
      return NextResponse.json(
        { error: "Invalid composting level. Use compost routing." },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        customer: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Find the lead for this user
    const lead = await prisma.lead.findFirst({
      where: { email: session.user.email },
      orderBy: [
        { convertedAt: "desc" },
        { submittedAt: "desc" },
      ],
    });

    if (!lead) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // Find the job for this customer
    const customerId = lead.convertedToCustomerId || user.customer?.id;
    let job = null;
    let plan = null;
    
    if (customerId) {
      job = await prisma.job.findFirst({
        where: { customerId },
        orderBy: { createdAt: "desc" },
      });
    }

    if (job) {
      plan = await prisma.customerBillingPlan.findUnique({
        where: { jobId: job.id },
      });
    }

    // Get add-on pricing from business config
    const config = await getBusinessConfig();
    const compostAddOnId = COMPOST_ADDON_IDS[compostLevel ?? "compost"] ?? "divert-compost";
    const addOnConfig = config.basePricing?.addOns?.find(
      (a) => a.id === compostAddOnId
    );
    
    const addOnPriceCents = addOnConfig?.priceCents || 1000;
    const existingDivertMode = normalizeDivertMode(lead.divertMode);
    const existingAddOnId = DIVERT_ADDON_IDS[existingDivertMode] ?? null;
    const existingAddOnConfig = existingAddOnId
      ? config.basePricing?.addOns?.find((a) => a.id === existingAddOnId)
      : null;
    const existingAddOnPriceCents = existingAddOnConfig?.priceCents ?? 0;

    let resolvedZoneMultiplier = 1;
    const zip = lead.zipCode ?? user.zipCode ?? null;
    if (zip) {
      try {
        resolvedZoneMultiplier = await getZoneMultiplierForZip(
          zip,
          lead.orgId ?? "yardura",
        );
      } catch {
        resolvedZoneMultiplier = 1;
      }
    }
    const addOnPerVisitCents = Math.round(addOnPriceCents * resolvedZoneMultiplier);
    const existingAddOnPerVisitCents = Math.round(
      existingAddOnPriceCents * resolvedZoneMultiplier,
    );

    // Update the lead with new divert mode
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        divertMode: compostLevel,
      },
    });

    // Update the job if it exists
    if (job) {
      // Calculate new per-visit revenue
      const currentRevenue = job.perVisitRevenueCents || 0;
      const newRevenue = Math.max(
        0,
        currentRevenue - existingAddOnPerVisitCents + addOnPerVisitCents,
      );

      await prisma.job.update({
        where: { id: job.id },
        data: {
          perVisitRevenueCents: newRevenue,
        },
      });

      if (plan) {
        const frequency = normalizeFrequency(lead.frequency ?? job.frequency ?? null);
        const weekendUpgrade = Boolean(
          plan.metadata &&
            typeof plan.metadata === "object" &&
            !Array.isArray(plan.metadata) &&
            (plan.metadata as Record<string, any>).serviceOptions?.weekendUpgrade,
        );
        const visitsPerMonthValue = visitsPerMonth(frequency, {
          weekendUpgrade,
        });
        const monthlyAddOnCents = Math.round(
          addOnPerVisitCents * visitsPerMonthValue,
        );
        const existingMonthlyAddOnCents = Math.round(
          existingAddOnPerVisitCents * visitsPerMonthValue,
        );

        await prisma.customerBillingPlan.update({
          where: { id: plan.id },
          data: {
            perVisitAmountCents: newRevenue,
            recurringAmountCents:
              plan.billingPreference === "monthly" && plan.recurringAmountCents != null
                ? Math.max(
                    0,
                    plan.recurringAmountCents -
                      existingMonthlyAddOnCents +
                      monthlyAddOnCents,
                  )
                : plan.recurringAmountCents,
          },
        });
      }

      // If there's a Stripe subscription, we should update it
      // For now, we'll just log and notify - in production you'd update Stripe
      if (job.stripeSubscriptionId) {
        try {
          // Get current subscription
          const subscription = await stripe.subscriptions.retrieve(
            job.stripeSubscriptionId
          );

          // In production, you would:
          // 1. Create a new price with the updated amount
          // 2. Update the subscription item
          // For now, we'll just add a note that manual update is needed
          
          console.log("[add-on] Stripe subscription needs manual update:", {
            subscriptionId: job.stripeSubscriptionId,
            addOn: addOn,
            level: level,
            addOnPriceCents: addOnPerVisitCents,
          });

          // Log an audit trail
          console.log("[add-on] Successfully updated add-on:", {
            userId: user.id,
            leadId: lead.id,
            jobId: job.id,
            addOn,
            level: compostLevel,
            newDivertMode: compostLevel,
          });
        } catch (stripeError) {
          console.error("[add-on] Stripe update failed:", stripeError);
          // Continue anyway - the local update succeeded
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Compost routing added to your plan",
      addOn,
      level: compostLevel,
      priceCents: addOnPerVisitCents,
    });
  } catch (error) {
    console.error("[add-on] Error adding add-on:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/subscription/add-on
 * 
 * Returns the current add-ons for the user
 */
export async function GET(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the lead for this user
    const lead = await prisma.lead.findFirst({
      where: { email: session.user.email },
      orderBy: [
        { convertedAt: "desc" },
        { submittedAt: "desc" },
      ],
      select: {
        divertMode: true,
        deodorize: true,
        deodorizeMode: true,
        sprayDeck: true,
        sprayDeckMode: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ addOns: {} });
    }

    return NextResponse.json({
      addOns: {
        composting: {
          active: lead.divertMode && !["none", "takeaway"].includes(lead.divertMode),
          level: lead.divertMode,
        },
        deodorize: {
          active: lead.deodorize,
          mode: lead.deodorizeMode,
        },
        sprayDeck: {
          active: lead.sprayDeck,
          mode: lead.sprayDeckMode,
        },
      },
    });
  } catch (error) {
    console.error("[add-on] Error fetching add-ons:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
