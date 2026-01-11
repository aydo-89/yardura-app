import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { calculatePrice } from "@/lib/priceEstimator";
import type { QuoteInput } from "@/lib/priceEstimator";
import type { PricingData } from "@/types/quote";
import { getSiteUrl } from "@/lib/env";

type QuoteAddOns = NonNullable<QuoteInput["addOns"]>;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

export async function POST(request: NextRequest) {
  try {
    const { leadId, promoCode } = await request.json();

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 },
      );
    }

    // Fetch lead data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        serviceType: true,
        dogs: true,
        yardSize: true,
        frequency: true,
        address: true,
        city: true,
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
        pricingBreakdown: true,
        estimatedPrice: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const normalizedFrequency = (() => {
      const raw = (lead.frequency || "weekly").toLowerCase().trim();
      if (
        [
          "weekdays",
          "weekday",
          "weekday-service",
          "daily",
          "weekday visits",
          "weekday-service",
        ].includes(raw)
      ) {
        return "daily";
      }
      if (raw === "twiceweekly" || raw === "twice-weekly" || raw === "2x") return "twice-weekly";
      if (
        raw === "biweekly" ||
        raw === "bi-weekly" ||
        raw === "every-other-week" ||
        raw === "every other week"
      ) {
        return "biweekly";
      }
      if (raw === "monthly") return "monthly";
      if (raw === "onetime" || raw === "one-time" || raw === "one time") return "onetime";
      if (raw === "weekly") return "weekly";
      return raw || "weekly";
    })() as string;

    const toNumber = (value: unknown): number => {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const cleaned = value.replace(/[$,\s]/g, "");
        if (!cleaned) return 0;
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const toCents = (value: unknown): number => {
      if (typeof value === "number") {
        if (Number.isInteger(value)) return value;
        return Math.round(value * 100);
      }
      if (typeof value === "string") {
        const cleaned = value.replace(/[$,\s]/g, "");
        if (!cleaned) return 0;
        if (cleaned.includes(".")) {
          const parsed = parseFloat(cleaned);
          return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
        }
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? Math.round(parsed) : 0;
      }
      return 0;
    };

    const normalizeAddonMap = (
      raw: unknown,
    ): { deodorize: number; sprayDeck: number; divert: number; other: number } => {
      const base = { deodorize: 0, sprayDeck: 0, divert: 0, other: 0 };
      if (!raw || typeof raw !== "object") return base;
      const source = raw as Record<string, unknown>;
      if (source.deodorize !== undefined)
        base.deodorize = toCents(source.deodorize);
      if (source.sprayDeck !== undefined)
        base.sprayDeck = toCents(source.sprayDeck);
      if (source.divert !== undefined)
        base.divert = toCents(source.divert);
      if (source.takeaway !== undefined && base.divert === 0)
        base.divert = toCents(source.takeaway);
      if (source.other !== undefined) base.other = toCents(source.other);
      return base;
    };

    const parseSnapshot = () => {
      let snapshot: any = lead.pricingBreakdown;
      if (!snapshot) return null;
      if (typeof snapshot === "string") {
        try {
          snapshot = JSON.parse(snapshot);
        } catch (error) {
          console.warn("Failed to parse pricing snapshot for lead", lead.id, error);
          return null;
        }
      }
      if (!snapshot || typeof snapshot !== "object") return null;
      return snapshot as Record<string, unknown>;
    };

    const snapshot = parseSnapshot();

    const snapshotPricing: PricingData | null = (() => {
      if (!snapshot) return null;

      if ("trialWeek" in snapshot || "postTrial" in snapshot) {
        return snapshot as PricingData;
      }

      const perVisitCents = toCents(snapshot.perVisit ?? snapshot.perVisitCents);
      const visitsPerMonth = toNumber(snapshot.visitsPerMonth ?? 0);

      let monthlyCents = toCents(
        snapshot.fullMonthlyAmount ?? snapshot.monthly ?? snapshot.monthlyCents,
      );
      if (monthlyCents === 0 && perVisitCents > 0 && visitsPerMonth > 0) {
        monthlyCents = Math.round(perVisitCents * visitsPerMonth);
      }

      const initialCleanCents = toCents(
        snapshot.initialClean ?? snapshot.initialCleanCents,
      );

      let discountedInitialCleanCents = toCents(
        snapshot.discountedInitialClean ?? snapshot.discountedInitialCleanCents,
      );
      if (
        discountedInitialCleanCents === 0 &&
        initialCleanCents > 0 &&
        snapshot.initialCleanDiscount !== undefined
      ) {
        const discountCents = toCents(snapshot.initialCleanDiscount);
        discountedInitialCleanCents = Math.max(
          0,
          initialCleanCents - discountCents,
        );
      }

      const initialCleanDiscountCents = Math.min(
        initialCleanCents,
        toCents(
          snapshot.initialCleanDiscount ??
            (initialCleanCents - discountedInitialCleanCents),
        ),
      );

      const firstVisitAddOns = normalizeAddonMap(snapshot.firstVisitAddOns);
      const recurringAddOns = normalizeAddonMap(snapshot.recurringAddOns);
      const firstVisitAddOnsTotalCents =
        firstVisitAddOns.deodorize +
        firstVisitAddOns.sprayDeck +
        firstVisitAddOns.divert +
        firstVisitAddOns.other;

      let firstVisitTotalCents = toCents(snapshot.firstVisitTotalCents);
      if (firstVisitTotalCents === 0) {
        firstVisitTotalCents = discountedInitialCleanCents + firstVisitAddOnsTotalCents;
      }

      let firstMonthCents = toCents(
        snapshot.firstMonthCents ?? snapshot.firstMonth,
      );
      if (firstMonthCents === 0 && monthlyCents > 0) {
        firstMonthCents = Math.max(0, monthlyCents - perVisitCents);
      }

      const amountDueTodayCents = toCents(
        snapshot.amountDueToday ?? firstMonthCents + firstVisitTotalCents,
      );

      const oneTimeCents = toCents(
        snapshot.oneTime ?? snapshot.oneTimeCents ?? snapshot.initialClean ?? initialCleanCents,
      );

      const firstMonthVisits = toNumber(snapshot.firstMonthVisits ?? 0);

      const isRecurringService = normalizedFrequency !== "onetime";
      const trialFollowUpVisitCount = (() => {
        if (!isRecurringService) return 0;
        if (normalizedFrequency === "daily") return 4;
        if (normalizedFrequency === "twice-weekly") return 1;
        return 0;
      })();

      const trialFollowUpVisitsValueCents = perVisitCents * trialFollowUpVisitCount;
      const trialWeekValueCents = initialCleanCents + trialFollowUpVisitsValueCents;
      const trialLengthDays = !isRecurringService
        ? 0
        : normalizedFrequency === "biweekly"
          ? 14
          : normalizedFrequency === "monthly"
            ? 7
            : 7;

      return {
        perVisit: perVisitCents,
        monthly: monthlyCents,
        oneTime: oneTimeCents,
        visitsPerMonth,
        firstMonthCents,
        firstMonthVisits,
        initialClean: initialCleanCents,
        initialCleanDiscount: initialCleanDiscountCents,
        discountedInitialClean: discountedInitialCleanCents,
        firstVisitTotalCents,
        firstVisitAddOns,
        recurringAddOns,
        firstVisitAddOnsTotal: firstVisitAddOnsTotalCents,
        amountDueToday: amountDueTodayCents,
        fullMonthlyAmount: monthlyCents,
        breakdown: snapshot.breakdown ?? null,
        zoneMultiplier:
          typeof snapshot.zoneMultiplier === "number"
            ? snapshot.zoneMultiplier
            : toNumber(snapshot.zoneMultiplier ?? 1) || 1,
        trialWeek: isRecurringService
          ? {
              initialCleanCents,
              followUpVisitCount: trialFollowUpVisitCount,
              followUpVisitsCents: trialFollowUpVisitsValueCents,
              addOnCents: 0,
              totalValueCents: trialWeekValueCents,
              creditsCents: {
                initialClean: initialCleanDiscountCents,
                followUpVisits: trialFollowUpVisitsValueCents,
                addOns: 0,
                total: initialCleanDiscountCents + trialFollowUpVisitsValueCents,
              },
              netDueCents: Math.max(
                trialWeekValueCents - (initialCleanDiscountCents + trialFollowUpVisitsValueCents),
                0,
              ),
              trialLengthDays,
            }
          : null,
        postTrial: isRecurringService
          ? {
              recurringPerVisitCents: perVisitCents,
              recurringMonthlyCents: monthlyCents,
              firstInvoiceAddOnsCents: firstVisitAddOnsTotalCents,
              firstInvoiceAddOns: firstVisitAddOns,
              premiumOnboardingCents: 0,
              activationDelayDays: trialLengthDays,
            }
          : null,
      } as PricingData;
    })();

    const pricing: PricingData = snapshotPricing
      ? snapshotPricing
      : ((await calculatePrice({
          dogs: lead.dogs || 1,
          yardSize: (lead.yardSize as any) || "medium",
          frequency: normalizedFrequency as any,
          addons: {
            deodorize: lead.deodorize || false,
            deodorizeMode: lead.deodorizeMode as QuoteAddOns["deodorizeMode"],
            sprayDeck: lead.sprayDeck || false,
            sprayDeckMode: lead.sprayDeckMode as QuoteAddOns["sprayDeckMode"],
            divertMode: (lead.divertMode as QuoteAddOns["divertMode"]) || "none",
          },
          areasToClean: (lead.areasToClean || undefined) as any,
          lastCleanedBucket: lead.lastCleanedBucket || undefined,
          lastCleanedDate: lead.lastCleanedDate?.toISOString(),
        })) as PricingData);

    let promoCodeData: any = null;
    if (promoCode) {
      try {
        const promoResponse = await fetch(
          `${getSiteUrl()}/api/promo-codes/validate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: promoCode }),
          },
        );

        if (promoResponse.ok) {
          promoCodeData = await promoResponse.json();
        }
      } catch (error) {
        console.error("Promo code validation error:", error);
      }
    }

    const existingCustomer = await prisma.user.findFirst({
      where: { email: lead.email },
      select: { stripeCustomerId: true },
    });

    let customerId: string | null = null;
    if (existingCustomer?.stripeCustomerId) {
      try {
        const existing = await stripe.customers.retrieve(
          existingCustomer.stripeCustomerId,
        );
        if (!("deleted" in existing && existing.deleted)) {
          customerId = existing.id;
        }
      } catch (error) {
        console.warn("Unable to retrieve existing Stripe customer", error);
      }
    }

    // Create SetupIntent for payment method collection
    // Note: mandate_data is only valid with confirm: true, so we omit it here
    // The client will confirm the SetupIntent with the payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId ?? undefined,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        leadId: lead.id,
        serviceType: lead.serviceType || "residential",
        frequency: lead.frequency || "weekly",
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      pricing,
      customerId: customerId || "",
      promoCode: promoCodeData,
    });
  } catch (error) {
    console.error("SetupIntent creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment setup" },
      { status: 500 },
    );
  }
}
