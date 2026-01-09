import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import {
  Prisma,
  CertificationType,
  Frequency,
  ServiceStatus,
  ServiceType,
  YardSize,
} from "@prisma/client";
import { Resend } from "resend";
import { calculatePricingWithConfig } from "@/lib/pricing";
import {
  calculateTrialConfiguration,
  upsertBillingPlan,
} from "@/lib/billing/plan";
import { createChargeEntry, createCreditEntry } from "@/lib/billing/ledger";
import { scheduleInitialVisitForJob } from "@/lib/dispatch/auto-schedule";
import { ensureZeroPrice } from "@/lib/billing/stripe-products";
import { createPlaceholderSubscription } from "@/lib/billing/stripe-subscription";
import { enqueueOfferPublishing } from "@/lib/jobs/marketplaceOfferPublisher";
import { getSiteUrl } from "@/lib/env";
import bcrypt from "bcryptjs";
import { computeIntroCredits } from "@/lib/billing/introCredits";
import { resolveTileByZipCode, resolveTileSlugForCity } from "@/lib/marketplace/tile-map";
import { getTileRepository } from "@/lib/tiles/repository";

import type { BillingPreference, TrialConfiguration } from "@/lib/billing/types";
import type { PricingCalculationInput, PricingResult } from "@/lib/configurable-pricing";
import {
  formatServiceDate,
  getPreferredTimeWindowStart,
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
  resolvePreferredTimeWindowShortLabel,
} from "@/lib/time-window";
import { addDays, startOfDay } from "date-fns";
import { constructZonedDate, getZonedWeekday, SERVICE_TIME_ZONE } from "@/lib/timezone";
import { sortRoles, type AppUserRole } from "@/lib/auth/roles";
import { normalizeAddressParts } from "@/lib/address/normalize";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const normalizeEmail = (value?: string | null): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Basic RFC 5322 compliant heuristic for email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return null;
  return trimmed.toLowerCase();
};

const LEGACY_DIVERT_MODE_PATTERN = /^\d{1,3}%?$/;

const normalizeDivertMode = (value?: string | null) => {
  if (!value) return "none";
  const normalized = value.toLowerCase().trim();
  if (normalized === "takeaway" || normalized === "haul-away" || normalized === "haulaway") {
    return "takeaway";
  }
  if (normalized === "compost") return "compost";
  if (LEGACY_DIVERT_MODE_PATTERN.test(normalized)) return "compost";
  if (normalized.startsWith("eco") && /\d/.test(normalized)) return "compost";
  return normalized || "none";
};

function resolveRequiredCertificationTypes(lead: {
  divertMode?: string | null;
}): CertificationType[] {
  const certs = new Set<CertificationType>();
  const divert = normalizeDivertMode(lead.divertMode);

  if (divert === "takeaway") {
    certs.add(CertificationType.HAUL_AWAY);
  }
  if (divert === "compost") {
    certs.add(CertificationType.ECO_DIVERT_100);
  }

  return Array.from(certs);
}

function resolveYardSize(value?: string | null): YardSize {
  switch ((value ?? "medium").toLowerCase()) {
    case "small":
      return YardSize.SMALL;
    case "large":
      return YardSize.LARGE;
    case "xlarge":
    case "xl":
      return YardSize.XLARGE;
    default:
      return YardSize.MEDIUM;
  }
}

function resolveServiceTypeFromFrequency(frequency: Frequency): ServiceType {
  return frequency === Frequency.ONE_TIME ? ServiceType.ONE_TIME : ServiceType.REGULAR;
}

function normalizeCents(value: unknown): number {
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber)) return 0;
  return Math.round(asNumber);
}

async function seedIntroCredits(options: {
  orgId: string;
  jobId: string;
  customerId: string;
  billingPreference: BillingPreference;
  normalizedFrequency: string;
  pricing: Record<string, any>;
  perVisitAmountCents: number;
  initialCleanAmountCents: number;
}) {
  const {
    orgId,
    jobId,
    customerId,
    billingPreference,
    normalizedFrequency,
    pricing,
    perVisitAmountCents,
    initialCleanAmountCents,
  } = options;

  let existingPromo = null;
  try {
    existingPromo = await prisma.customerBillingLedgerEntry.findFirst({
      where: {
        jobId,
        metadata: {
          path: ["source"],
          equals: "promo-credit",
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      console.warn(
        "[onboarding] CustomerBillingLedgerEntry table not found; skipping intro credits.",
        error,
      );
      return;
    }
    throw error;
  }

  if (existingPromo) {
    return;
  }

  const initialCleanCents = normalizeCents(initialCleanAmountCents);

  const perVisitCents = normalizeCents(perVisitAmountCents);

  const { credits } = computeIntroCredits({
    normalizedFrequency,
    initialCleanCents,
    perVisitCents,
  });

  try {
    await Promise.all(
      credits.map((credit) =>
        createCreditEntry({
          orgId,
          jobId,
          customerId,
          amountCents: credit.amountCents,
          description: credit.label,
          metadata: {
            source: "promo-credit",
            reason: credit.reason,
            ...(credit.visits ? { visits: credit.visits } : {}),
          },
        }),
      ),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2021"
    ) {
      console.warn(
        "[onboarding] Billing ledger tables missing; skipping intro credits.",
        error,
      );
      return;
    }
    throw error;
  }
}

async function handleOnboardingComplete(request: NextRequest): Promise<NextResponse> {
  console.log("[API] POST /api/onboarding/complete started at", new Date().toISOString());
  try {
    console.log("[API] Parsing request body...");
    const {
      leadId,
      setupIntentId,
      scheduledDate,
      amount,
      authMethod,
      password,
      billingPreference,
      timeWindowPreference,
      dogDoor,
      dogsOutside,
      cleanWithDogs,
      gateLocation,
      gateLocationNotes,
      trashLocation,
      trashLocationNotes,
      communityGateAccess,
      communityGateCode,
      homeGateAccess,
      homeGateCode,
      accessNotes,
    } = await request.json();

    const toOptionalString = (value: unknown): string | null =>
      typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

    const toYesNo = (value: unknown): "yes" | "no" | null => {
      if (typeof value !== "string") return null;
      const normalized = value.trim().toLowerCase();
      return normalized === "yes" || normalized === "no" ? normalized : null;
    };

    if (!leadId || !setupIntentId) {
      return NextResponse.json(
        { error: "Lead ID and SetupIntent ID are required" },
        { status: 400 },
      );
    }

    // Retrieve and verify SetupIntent
    console.log("[API] Retrieving SetupIntent:", setupIntentId);
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    console.log("[API] SetupIntent retrieved, status:", setupIntent.status);
    if (setupIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment setup was not completed" },
        { status: 400 },
      );
    }

    let stripeCustomerId =
      typeof setupIntent.customer === "string"
        ? (setupIntent.customer as string)
        : ((setupIntent.customer as Stripe.Customer | null)?.id ?? null);
    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? (setupIntent.payment_method as string)
        : (setupIntent.payment_method as Stripe.PaymentMethod | null)?.id ?? null;

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "Payment method was not saved. Please re-enter your card." },
        { status: 400 },
      );
    }

    // Get lead data
    console.log("[API] Fetching lead:", leadId);
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
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
        status: true,
        deodorize: true,
        deodorizeMode: true,
        sprayDeck: true,
        sprayDeckMode: true,
        divertMode: true,
        areasToClean: true,
        submittedAt: true,
        preferredStartDate: true,
        orgId: true,
        pricingBreakdown: true,
        specialInstructions: true,
      },
    });

    console.log("[API] Lead fetched:", lead?.id || "NOT FOUND");
    
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (lead.status === "WON") {
      return NextResponse.json(
        { error: "This account has already been onboarded." },
        { status: 409 },
      );
    }

    const orgId = lead.orgId || "yardura";
    const fullName = `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim();

    const now = new Date();

    let paymentMethodDetails: Stripe.PaymentMethod | null = null;
    try {
      paymentMethodDetails = await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (error) {
      console.error("Unable to retrieve payment method details", error);
    }

    let stripeCustomerEmail: string | null = null;
    if (stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        if (!("deleted" in customer)) {
          stripeCustomerEmail = customer.email ?? null;
        }
      } catch (customerError) {
        console.error("Unable to retrieve Stripe customer", customerError);
      }
    }

    const setupIntentMetadata = (setupIntent.metadata ?? {}) as Record<string, unknown>;
    const candidateEmails: Array<string | null | undefined> = [
      lead.email,
      typeof setupIntentMetadata.contactEmail === "string"
        ? setupIntentMetadata.contactEmail
        : null,
      typeof setupIntentMetadata.customerEmail === "string"
        ? setupIntentMetadata.customerEmail
        : null,
      stripeCustomerEmail,
      paymentMethodDetails?.billing_details?.email ?? null,
    ];

    const normalizedLeadEmail = normalizeEmail(lead.email);
    const effectiveEmail =
      candidateEmails.map(normalizeEmail).find((email) => email) ?? normalizedLeadEmail;

    if (!effectiveEmail) {
      return NextResponse.json(
        {
          error:
            "We weren't able to validate the contact email. Please update it and try again.",
        },
        { status: 400 },
      );
    }

    const leadEmailWasInvalid = !normalizedLeadEmail;
    if (leadEmailWasInvalid && lead.email !== effectiveEmail) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { email: effectiveEmail },
      });
      lead.email = effectiveEmail;
    }

    const normalizeDate = (input: unknown): Date | null => {
      if (!input) return null;
      if (typeof input === "string") {
        const trimmed = input.trim();
        if (!trimmed) return null;
        const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateOnlyMatch) {
          const [, yearStr, monthStr, dayStr] = dateOnlyMatch;
          const year = Number(yearStr);
          const month = Number(monthStr);
          const day = Number(dayStr);
          if (
            Number.isFinite(year) &&
            Number.isFinite(month) &&
            Number.isFinite(day)
          ) {
            return constructZonedDate(year, month, day, 0, 0, 0, 0);
          }
        }
      }
      const parsed = new Date(input as string | number | Date);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const fallbackStartDate = (() => {
      const next = new Date(now);
      const currentWeekday = getZonedWeekday(now, SERVICE_TIME_ZONE);
      const daysUntilNextMonday = ((1 + 7 - currentWeekday) % 7) || 7;
      next.setDate(now.getDate() + daysUntilNextMonday);
      next.setHours(9, 0, 0, 0);
      return next;
    })();

    let preferredStart =
      normalizeDate(scheduledDate) ??
      normalizeDate(lead.preferredStartDate) ??
      new Date(fallbackStartDate);

    const minimumStart = addDays(startOfDay(now), 2);
    if (!preferredStart || preferredStart < minimumStart) {
      preferredStart = new Date(minimumStart);
    }

    const normalizedTimeWindowSlug = normalizePreferredTimeWindowSlug(
      timeWindowPreference,
    );

    if (preferredStart) {
      if (normalizedTimeWindowSlug) {
        const startWindow = getPreferredTimeWindowStart(normalizedTimeWindowSlug);
        if (startWindow) {
          preferredStart.setHours(startWindow.hour, startWindow.minute, 0, 0);
        }
      } else if (
        preferredStart.getHours() === 0 &&
        preferredStart.getMinutes() === 0 &&
        preferredStart.getSeconds() === 0
      ) {
        preferredStart.setHours(9, 0, 0, 0);
      } else {
        preferredStart.setMinutes(0, 0, 0);
      }
    }

    const normalizedTimeWindowLabel = resolvePreferredTimeWindowLabel(
      normalizedTimeWindowSlug,
      typeof timeWindowPreference === "string"
        ? timeWindowPreference
        : null,
    );

    const normalizedAddress = normalizeAddressParts({
      addressLine1: lead.address ?? null,
      city: lead.city ?? null,
      state: lead.state ?? null,
      zip: lead.zipCode ?? null,
    });
    const leadAddressLine1 = normalizedAddress.addressLine1 ?? lead.address ?? null;
    const leadCity = normalizedAddress.city ?? lead.city ?? null;
    const leadState = normalizedAddress.state ?? lead.state ?? null;
    const leadZip = normalizedAddress.zip ?? lead.zipCode ?? null;

    // Get or create user
    let user = await prisma.user.findFirst({
      where: { email: effectiveEmail },
    });

    if (!user && lead.email && lead.email !== effectiveEmail) {
      user = await prisma.user.findFirst({
        where: { email: lead.email },
      });
    }

    console.log("[API] User lookup result:", user?.id || "NOT FOUND - will create");
    if (!user) {
      console.log("[API] Creating new user...");
      user = await prisma.user.create({
        data: {
          email: effectiveEmail,
          name: fullName || effectiveEmail,
          phone: lead.phone,
          address: leadAddressLine1,
          city: leadCity,
          zipCode: leadZip,
          role: "CUSTOMER",
          roles: ["CUSTOMER"],
          orgId,
        },
      });

      // Create password-based account if user chose password authentication
      if (authMethod === "password" && password) {
        const hashedPassword = await bcrypt.hash(password, 12);
        await prisma.account.create({
          data: {
            userId: user.id,
            type: "credentials",
            provider: "credentials",
            providerAccountId: user.id,
            access_token: hashedPassword, // Store hashed password in access_token field
          },
        });
      }
    }
    else {
      const userUpdate: Record<string, any> = {};
      if (effectiveEmail && effectiveEmail !== user.email) {
        userUpdate.email = effectiveEmail;
      }
      if (fullName && fullName !== user.name) {
        userUpdate.name = fullName;
      }
      if (lead.phone && lead.phone !== user.phone) {
        userUpdate.phone = lead.phone;
      }
      if (leadAddressLine1 && leadAddressLine1 !== user.address) {
        userUpdate.address = leadAddressLine1;
      }
      if (leadCity && leadCity !== user.city) {
        userUpdate.city = leadCity;
      }
      if (leadZip && leadZip !== user.zipCode) {
        userUpdate.zipCode = leadZip;
      }
      if (!user.orgId && orgId) {
        userUpdate.orgId = orgId;
      }

      if (Object.keys(userUpdate).length > 0) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: userUpdate,
        });
      }
    }

    if (user) {
      const existingRoles = (user.roles ?? []) as string[];
      if (!existingRoles.includes("CUSTOMER")) {
        const nextRoles = sortRoles([...existingRoles, "CUSTOMER"] as AppUserRole[]);
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            role: nextRoles[0] ?? user.role ?? "CUSTOMER",
            roles: nextRoles,
          },
        });
      }
    }

    let ensuredStripeCustomerId = stripeCustomerId;
    let needsNewCustomer = !ensuredStripeCustomerId;
    
    // If we have a stored customer ID, verify it still exists in Stripe
    if (ensuredStripeCustomerId) {
      try {
        await stripe.customers.retrieve(ensuredStripeCustomerId);
      } catch (error) {
        // Customer doesn't exist in Stripe anymore, we'll need to create a new one
        if ((error as any)?.code === "resource_missing") {
          console.warn(`Stored Stripe customer ${ensuredStripeCustomerId} not found, creating new one`);
          ensuredStripeCustomerId = null;
          needsNewCustomer = true;
        } else {
          throw error;
        }
      }
    }
    
    try {
      if (needsNewCustomer) {
        const customerPayload: Stripe.CustomerCreateParams = {
          name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() ||
            fullName ||
            effectiveEmail,
          phone: lead.phone || undefined,
          address: {
            line1: leadAddressLine1 || undefined,
            city: leadCity || undefined,
            state: leadState || undefined,
            postal_code: leadZip || undefined,
            country: "US",
          },
          metadata: {
            leadId: lead.id,
            serviceType: lead.serviceType || "residential",
          },
        };

        if (effectiveEmail) {
          customerPayload.email = effectiveEmail;
        }

        console.log("[API] Creating Stripe customer...");
        const newCustomer = await stripe.customers.create(customerPayload);
        console.log("[API] Stripe customer created:", newCustomer.id);

        ensuredStripeCustomerId = newCustomer.id;

        try {
          const customerId = ensuredStripeCustomerId;
          if (!customerId) {
            throw new Error("Stripe customer ID missing after creation");
          }
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
          });
        } catch (error) {
          if ((error as any)?.code !== "resource_already_exists" && (error as any)?.code !== "resource_already_attached") {
            throw error;
          }
        }
      } else {
        try {
          const customerId = ensuredStripeCustomerId;
          if (!customerId) {
            throw new Error("Stripe customer ID missing for attachment");
          }
          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customerId,
          });
        } catch (error) {
          if ((error as any)?.code !== "resource_already_exists" && (error as any)?.code !== "resource_already_attached") {
            throw error;
          }
        }

        if (effectiveEmail) {
          try {
            const customerId = ensuredStripeCustomerId;
            if (!customerId) {
              throw new Error("Stripe customer ID missing for update");
            }
            await stripe.customers.update(customerId, {
              email: effectiveEmail,
            });
          } catch (error) {
            console.error("Failed to update Stripe customer email", error);
          }
        }
      }
    } catch (error) {
      console.error("Failed to ensure Stripe customer", error);
      return NextResponse.json(
        { error: "Unable to save billing details. Please try again." },
        { status: 400 },
      );
    }

    if (!ensuredStripeCustomerId) {
      return NextResponse.json(
        { error: "Unable to prepare billing profile. Please try again." },
        { status: 400 },
      );
    }

    if (!user.stripeCustomerId || user.stripeCustomerId !== ensuredStripeCustomerId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: ensuredStripeCustomerId },
      });
    }

    stripeCustomerId = ensuredStripeCustomerId;

    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Unable to link customer profile." },
        { status: 400 },
      );
    }

    const normalizedGateLocation = toOptionalString(gateLocation)?.toLowerCase() ?? null;
    const normalizedTrashLocation = toOptionalString(trashLocation)?.toLowerCase() ?? null;
    const normalizedCommunityGateAccess = toYesNo(communityGateAccess);
    const normalizedHomeGateAccess = toYesNo(homeGateAccess);
    const normalizedDogDoor = toYesNo(dogDoor);
    const normalizedDogsOutside = toYesNo(dogsOutside);
    const normalizedCleanWithDogs = toYesNo(cleanWithDogs);
    const trimmedCommunityGateCode = toOptionalString(communityGateCode);
    const trimmedHomeGateCode = toOptionalString(homeGateCode);
    const trimmedAccessNotes = toOptionalString(accessNotes);
    const trimmedGateLocationNotes = toOptionalString(gateLocationNotes);
    const trimmedTrashLocationNotes = toOptionalString(trashLocationNotes);

    const gateLocationLabelMap: Record<string, string> = {
      left: "Left side gate",
      back: "Back fence gate (alley entry)",
      right: "Right side gate",
      front: "Front entrance / porch meet-up",
      alley: "Alley/back gate",
      other: "Custom gate instructions",
    };

    const trashLocationLabelMap: Record<string, string> = {
      left: "Left-side bins",
      right: "Right-side bins",
      garage: "Inside the garage",
      curb: "Curbside city bin",
      alley: "Alley bin/enclosure",
      other: "Custom location",
    };

    const accessDetailLines: string[] = [];

    let gateLabel: string | null = null;
    if (normalizedGateLocation) {
      gateLabel =
        gateLocationLabelMap[normalizedGateLocation] ??
        `Gate location: ${normalizedGateLocation}`;
      accessDetailLines.push(`Gate access: ${gateLabel}`);
      if (trimmedGateLocationNotes) {
        accessDetailLines.push(`Gate notes: ${trimmedGateLocationNotes}`);
      }
    }

    if (normalizedCommunityGateAccess === "yes") {
      accessDetailLines.push(
        `Community gate: code ${trimmedCommunityGateCode ?? "provided separately"}`,
      );
    } else if (normalizedCommunityGateAccess === "no") {
      accessDetailLines.push("Community gate: not required");
    }

    if (normalizedHomeGateAccess === "yes") {
      accessDetailLines.push(
        `Backyard gate lock: ${trimmedHomeGateCode ?? "code/key noted"}`,
      );
    } else if (normalizedHomeGateAccess === "no") {
      accessDetailLines.push("Backyard gate lock: not needed");
    }

    let trashLabel: string | null = null;
    if (normalizedTrashLocation) {
      trashLabel =
        trashLocationLabelMap[normalizedTrashLocation] ??
        `Trash location: ${normalizedTrashLocation}`;
      accessDetailLines.push(`Trash bins: ${trashLabel}`);
      if (trimmedTrashLocationNotes) {
        accessDetailLines.push(`Trash note: ${trimmedTrashLocationNotes}`);
      }
    }

    if (normalizedDogDoor) {
      accessDetailLines.push(`Doggy door: ${normalizedDogDoor === "yes" ? "Yes" : "No"}`);
    }

    if (normalizedDogsOutside) {
      accessDetailLines.push(
        `Dogs outside unsupervised: ${normalizedDogsOutside === "yes" ? "Yes" : "No"}`,
      );
    }

    if (normalizedCleanWithDogs) {
      accessDetailLines.push(
        `Okay to work with dogs present: ${normalizedCleanWithDogs === "yes" ? "Yes" : "Prefer notice"}`,
      );
    }

    if (trimmedAccessNotes) {
      accessDetailLines.push(`Access notes: ${trimmedAccessNotes}`);
    }

    const specialInstructionPrefixes = [
      "preferred arrival window",
      "gate access",
      "community gate",
      "backyard gate",
      "house gate",
      "trash bins",
      "doggy door",
      "dogs outside",
      "okay to work with dogs",
      "work with dogs",
      "access notes",
    ];

    const uniqueAccessLines = Array.from(new Set(accessDetailLines));

    const normalizedDivertMode = normalizeDivertMode(lead.divertMode);

    const shouldShowTrashPlacement = normalizedDivertMode === "none";

    const requiresGatePhoto = normalizedGateLocation
      ? normalizedGateLocation !== "front"
      : true;

    // If divertMode is "none" (leave in my bin), always require bag drop photo
    // The trash location is just helpful context for the tech, but photo is required
    const requiresBagDropPhoto = shouldShowTrashPlacement;

    const accessPreferencesMetadata: Record<string, unknown> | null = {
      gateLocation: normalizedGateLocation,
      gateLabel,
      communityGate: {
        required: normalizedCommunityGateAccess === "yes",
        code: trimmedCommunityGateCode,
      },
      homeGate: {
        hasLock: normalizedHomeGateAccess === "yes",
        code: trimmedHomeGateCode,
      },
      trashLocation: normalizedTrashLocation,
      trashLabel,
      notes: trimmedAccessNotes,
      gateNotes: trimmedGateLocationNotes,
      trashNotes: trimmedTrashLocationNotes,
      requiresGatePhoto,
    };

    const dogPreferencesMetadata: Record<string, unknown> | null = {
      dogDoor: normalizedDogDoor,
      dogsOutside: normalizedDogsOutside,
      cleanWithDogs: normalizedCleanWithDogs,
    };

    const disposalPreferencesMetadata: Record<string, unknown> | null = {
      mode: normalizedDivertMode,
      requiresBinConfirmation: requiresBagDropPhoto,
      trashLocation: normalizedTrashLocation,
      trashLabel: trashLabel || (requiresBagDropPhoto ? "the designated bin" : null),
      trashNotes: trimmedTrashLocationNotes,
    };

    // Get or create customer
    let customer = await prisma.customer.findFirst({
      where: { email: effectiveEmail },
    });

    if (!customer && lead.email && lead.email !== effectiveEmail) {
      customer = await prisma.customer.findFirst({
        where: { email: lead.email },
      });
    }

    // Also check for existing customer by userId to prevent unique constraint violation
    if (!customer) {
      customer = await prisma.customer.findFirst({
        where: { userId: user.id },
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          orgId,
          userId: user.id,
          name: fullName || effectiveEmail,
          email: effectiveEmail,
          phone: lead.phone,
          addressLine1: leadAddressLine1 || "",
          city: leadCity || "",
          state: leadState || "",
          zip: leadZip || "",
          latitude: lead.latitude,
          longitude: lead.longitude,
        },
      });
    }
    else {
      const customerUpdate: Record<string, any> = {};
      if (effectiveEmail && effectiveEmail !== customer.email) {
        customerUpdate.email = effectiveEmail;
      }
      if (fullName && fullName !== customer.name) {
        customerUpdate.name = fullName;
      }
      if (lead.phone && lead.phone !== customer.phone) {
        customerUpdate.phone = lead.phone;
      }
      if (leadAddressLine1 && leadAddressLine1 !== customer.addressLine1) {
        customerUpdate.addressLine1 = leadAddressLine1;
      }
      if (leadCity && leadCity !== customer.city) {
        customerUpdate.city = leadCity;
      }
      if (leadState && leadState !== customer.state) {
        customerUpdate.state = leadState;
      }
      if (leadZip && leadZip !== customer.zip) {
        customerUpdate.zip = leadZip;
      }
      if (lead.latitude != null && lead.latitude !== customer.latitude) {
        customerUpdate.latitude = lead.latitude;
      }
      if (lead.longitude != null && lead.longitude !== customer.longitude) {
        customerUpdate.longitude = lead.longitude;
      }
      if (!customer.userId) {
        customerUpdate.userId = user.id;
      } else if (customer.userId !== user.id) {
        console.warn(
          `Onboarding: customer ${customer.id} already linked to user ${customer.userId}, expected ${user.id}. Keeping existing link.`,
        );
      }

      if (uniqueAccessLines.length > 0) {
        const existingCustomerNoteLines = (customer.notes ?? "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(
            (line) =>
              line.length > 0 &&
              !specialInstructionPrefixes.some((prefix) =>
                line.toLowerCase().startsWith(prefix),
              ),
          );

        const combinedCustomerNotes = [...existingCustomerNoteLines, ...uniqueAccessLines]
          .filter((line, index, array) => line.length > 0 && array.indexOf(line) === index)
          .join("\n")
          .trim();

        if (combinedCustomerNotes) {
          customerUpdate.notes = combinedCustomerNotes;
        }
      }

      if (Object.keys(customerUpdate).length > 0) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: customerUpdate,
        });
      }
    }

    // Calculate pricing for subscription
    const addOns = {
      deodorize: lead.deodorize || false,
      litter: false,
    };

    const parsedAreasToClean: PricingCalculationInput["areasToClean"] | undefined = (() => {
      if (!lead.areasToClean) return undefined;
      if (typeof lead.areasToClean === "string") {
        try {
          const parsed = JSON.parse(lead.areasToClean);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as PricingCalculationInput["areasToClean"])
            : undefined;
        } catch {
          return undefined;
        }
      }
      if (typeof lead.areasToClean === "object" && !Array.isArray(lead.areasToClean)) {
        return lead.areasToClean as PricingCalculationInput["areasToClean"];
      }
      return undefined;
    })();
    const extraAreas = (() => {
      if (!parsedAreasToClean) return 0;
      const selectedCount = Object.entries(parsedAreasToClean).filter(([key, value]) => {
        if (key === "other") {
          return typeof value === "string" && value.trim().length > 0;
        }
        return Boolean(value);
      }).length;
      return Math.max(0, selectedCount - 1);
    })();

    const frequencyInput = (lead.frequency || "weekly").toLowerCase();
    const yardSizeInput = (lead.yardSize || "medium").toLowerCase();

    const pricing = await calculatePricingWithConfig(
      lead.dogs || 1,
      (frequencyInput === "twice-weekly"
        ? "twice-weekly"
        : frequencyInput === "biweekly"
          ? "bi-weekly"
          : frequencyInput === "monthly"
            ? "monthly"
            : frequencyInput === "one-time" || frequencyInput === "onetime"
              ? "one-time"
              : "weekly") as "weekly" | "bi-weekly" | "twice-weekly" | "one-time",
      (yardSizeInput === "small"
        ? "small"
        : yardSizeInput === "large"
          ? "large"
          : yardSizeInput === "xl" || yardSizeInput === "xlarge"
            ? "xlarge"
            : "medium") as "small" | "medium" | "large" | "xlarge",
      addOns,
      1.0,
      orgId,
      {
        areasToClean: parsedAreasToClean,
      },
    );

    const normalizedBillingPreference =
      billingPreference === "weekly" ? "weekly" : "monthly";

    const normalizedLeadFrequency = (lead.frequency || "weekly")
      .toLowerCase()
      .replace(/_/g, "-")
      .trim();

    const perVisitCents = Math.max(
      0,
      Math.round(Number(pricing.perVisitCents ?? 0)),
    );
    const pricingAny = pricing as any;
    const existingPricingBreakdown =
      lead.pricingBreakdown && typeof lead.pricingBreakdown === "object"
        ? (lead.pricingBreakdown as Record<string, any>)
        : null;
    const weekendUpgrade = Boolean(
      pricingAny.weekendUpgrade ??
        pricingAny.breakdown?.serviceOptions?.weekendUpgrade ??
        existingPricingBreakdown?.metadata?.weekendUpgrade ??
        lead.specialInstructions?.toLowerCase().includes("weekend"),
    );
    const monthlyAmountCentsRaw =
      (pricingAny.fullMonthlyAmount as number | undefined) ??
      (pricingAny.fullMonthlyAmountCents as number | undefined) ??
      (pricingAny.monthlyCents as number | undefined) ??
      (pricingAny.monthly as number | undefined) ??
      (pricingAny.amountDueToday as number | undefined) ??
      (pricingAny.firstMonthCents as number | undefined) ??
      pricing.perVisitCents;
    const monthlyAmountCents = Math.max(
      0,
      Math.round(Number(monthlyAmountCentsRaw) || 0),
    );

    // Determine upfront charge (monthly members pay first month, pay-per-visit may pay reduced or $0)
    // Ensure default payment method is set for future invoices
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const planPreference: BillingPreference = (() => {
      if (
        normalizedLeadFrequency === "one-time" ||
        normalizedLeadFrequency === "onetime"
      ) {
        return "one-time";
      }
      if (normalizedBillingPreference === "monthly") {
        return "monthly";
      }
      return "per-visit";
    })();

    const kickoffAnchor = preferredStart
      ? new Date(
          preferredStart.getFullYear(),
          preferredStart.getMonth(),
          preferredStart.getDate(),
        )
      : null;

    const trialConfig: TrialConfiguration =
      planPreference === "one-time"
        ? {
            trialStartsAt: kickoffAnchor,
            trialEndsAt: null,
            activationStartsAt: kickoffAnchor,
            firstChargeAt: null,
            freeDays: 0,
            billingCadenceDays: null,
            billingDelayDays: null,
          }
        : calculateTrialConfiguration(
            normalizedBillingPreference === "monthly" ? "monthly" : "weekly",
            lead.frequency,
            preferredStart,
            now,
          );

    // Create job in database
    const jobFrequency = (() => {
      switch (normalizedLeadFrequency) {
        case "weekly":
          return Frequency.WEEKLY;
        case "twice-weekly":
        case "twiceweekly":
          return Frequency.TWICE_WEEKLY;
        case "daily":
          return Frequency.DAILY;
        case "bi-weekly":
        case "biweekly":
        case "every-other-week":
          return Frequency.BI_WEEKLY;
        case "one-time":
        case "onetime":
          return Frequency.ONE_TIME;
        case "monthly":
          return Frequency.MONTHLY;
        default:
          return Frequency.WEEKLY;
      }
    })();

    // Try to resolve tile by ZIP code first (most accurate), then fall back to city
    console.log("[API] Resolving tile by ZIP...");
    const tileMatch = await resolveTileByZipCode(
      orgId,
      lead.zipCode ?? customer.zip,
    );
    let tileSlug = tileMatch?.slug ?? null;

    if (!tileSlug) {
      console.log("No tile found by ZIP, trying city:", lead.city ?? customer.city);
      const cityTile = await resolveTileSlugForCity(orgId, lead.city ?? customer.city);
      tileSlug = cityTile?.slug ?? null;
    }

    const requiredCertificationTypes = resolveRequiredCertificationTypes(lead);

    const tileRepository = getTileRepository();

    // Verify tile exists and is LIVE if we have a tile slug, otherwise set to null
    let activeTile: { id: string; slug: string } | null = null;
    if (tileSlug) {
      const repoTile = await tileRepository.getTileBySlug(orgId, tileSlug, {
        metricsLimit: 1,
      });

      if (repoTile?.tile.status === "LIVE") {
        const upsertedTile = await prisma.serviceTile.upsert({
          where: { orgId_slug: { orgId, slug: repoTile.tile.slug } },
          update: {
            name: repoTile.tile.name,
            status: repoTile.tile.status,
            minCertifiedScoopers: repoTile.tile.minCertifiedScoopers,
            minCustomerUnits: repoTile.tile.minCustomerUnits,
            coverageRadiusMeters: repoTile.tile.coverageRadiusMeters,
            goLiveDate: repoTile.tile.goLiveDate,
            notes: repoTile.tile.notes ?? null,
            territoryId: repoTile.tile.territoryId,
          },
          create: {
            orgId,
            slug: repoTile.tile.slug,
            name: repoTile.tile.name,
            status: repoTile.tile.status,
            minCertifiedScoopers: repoTile.tile.minCertifiedScoopers,
            minCustomerUnits: repoTile.tile.minCustomerUnits,
            coverageRadiusMeters: repoTile.tile.coverageRadiusMeters,
            goLiveDate: repoTile.tile.goLiveDate,
            notes: repoTile.tile.notes ?? null,
            territoryId: repoTile.tile.territoryId,
          },
          select: { id: true, slug: true },
        });

        activeTile = { id: upsertedTile.id, slug: upsertedTile.slug };
      } else if (repoTile) {
        console.log("Tile found but not LIVE, skipping assignment:", repoTile.tile.status);
      }
    }
    const validTileId = activeTile?.id ?? null;

    console.log("[API] Creating job for customer:", customer?.id);
    const job = await prisma.job.create({
      data: {
        orgId,
        customerId: customer.id,
        frequency: jobFrequency,
        dogCount: lead.dogs ?? 1,
        dayOfWeek: null,
        tileId: validTileId,
        perVisitRevenueCents: perVisitCents,
        deodorizeMode:
        lead.deodorizeMode === "each-visit"
          ? "EACH_VISIT"
          : lead.deodorizeMode === "first-visit"
            ? "FIRST_VISIT"
            : "NONE",
        extraAreas,
        stripeSubscriptionId: null,
      },
    });

    let stripeSubscriptionId: string | null = null;

    if (planPreference === "monthly" && stripeCustomerId) {
      try {
        const priceId = await ensureZeroPrice(planPreference, normalizedLeadFrequency || "weekly");
        const subscription = await createPlaceholderSubscription({
          customerId: stripeCustomerId,
          paymentMethodId,
          priceId,
          trialEndsAt: trialConfig.trialEndsAt ?? null,
          metadata: {
            jobId: job.id,
            customerId: customer.id,
            billingPreference: planPreference,
          },
        });
        stripeSubscriptionId = subscription.id;
        await prisma.job.update({
          where: { id: job.id },
          data: { stripeSubscriptionId },
        });
      } catch (subscriptionError) {
        console.error("[onboarding] Failed to create placeholder subscription", subscriptionError);
      }
    }

    try {
      await upsertBillingPlan({
        orgId,
        jobId: job.id,
        customerId: customer.id,
        stripeCustomerId,
        billingPreference: planPreference,
        stripeSubscriptionId,
        stripeScheduleId: null,
        trialEndsAt: trialConfig.trialEndsAt ?? null,
        firstChargeAmountCents:
          planPreference === "monthly" ? 0 : null,
        recurringAmountCents:
          planPreference === "monthly" ? monthlyAmountCents : null,
        perVisitAmountCents: perVisitCents,
        pricingSnapshot: lead.pricingBreakdown as Record<string, unknown> | null,
        metadata: {
          leadId: lead.id,
          frequency: lead.frequency ?? null,
          billingPreference: normalizedBillingPreference,
          billingAutomation: {
            trialStartsAt: trialConfig.trialStartsAt?.toISOString() ?? null,
            trialEndsAt: trialConfig.trialEndsAt?.toISOString() ?? null,
            activationStartsAt:
              trialConfig.activationStartsAt?.toISOString() ?? null,
            firstChargeAt: trialConfig.firstChargeAt?.toISOString() ?? null,
            billingCadenceDays: trialConfig.billingCadenceDays,
            billingDelayDays: trialConfig.billingDelayDays,
            lastBaseEntryAt: null,
          },
          serviceOptions: {
            weekendUpgrade,
          },
          accessPreferences: accessPreferencesMetadata,
          dogPreferences: dogPreferencesMetadata,
          disposalPreferences: disposalPreferencesMetadata,
          requiresGatePhoto,
          requiresBagDropPhoto,
        },
      });
    } catch (planError) {
      if (
        planError instanceof Prisma.PrismaClientKnownRequestError &&
        planError.code === "P2021"
      ) {
        console.warn(
          "[onboarding] CustomerBillingPlan table not found; skipping plan creation.",
          planError,
        );
      } else {
        throw planError;
      }
    }

    const resolveNumber = (value: unknown): number | null =>
      typeof value === "number" && Number.isFinite(value) ? value : null;
    const snapshot = pricing as unknown as Record<string, unknown>;
    const initialCleanAmountCents = normalizeCents(
      resolveNumber((pricing as PricingResult).initialClean) ??
        resolveNumber(snapshot.initialCleanCents) ??
        resolveNumber(snapshot.discountedInitialClean) ??
        resolveNumber(snapshot.firstVisitTotalCents) ??
        0,
    );

    await seedIntroCredits({
      orgId,
      jobId: job.id,
      customerId: customer.id,
      billingPreference: planPreference,
      normalizedFrequency: normalizedLeadFrequency,
      pricing,
      perVisitAmountCents: perVisitCents,
      initialCleanAmountCents,
    });

    const visitMetadata = (() => {
      const base: Record<string, unknown> = {};
      if (normalizedTimeWindowLabel) {
        base.preferredTimeWindow = normalizedTimeWindowLabel;
      }
      if (normalizedTimeWindowSlug) {
        base.preferredTimeWindowSlug = normalizedTimeWindowSlug;
      }
      if (activeTile) {
        base.serviceTileSlug = activeTile.slug;
      }

      return Object.keys(base).length ? base : undefined;
    })();

    let firstVisit:
      | Awaited<ReturnType<typeof scheduleInitialVisitForJob>>
      | null = null;

    try {
      console.log("[API] Calling scheduleInitialVisitForJob with validTileId:", validTileId);
      firstVisit = await scheduleInitialVisitForJob({
        orgId,
        jobId: job.id,
        customerId: customer.id,
        frequency: job.frequency,
        preferredStartDate: preferredStart,
        yardSizeHint: lead.yardSize,
        dogsCount: lead.dogs,
        metadata: visitMetadata,
        primaryUserId: user.id,
        billingPreference: normalizedBillingPreference,
        tileId: validTileId,
        requiredCertificationTypes,
        revenueCents: perVisitCents,
        weekendUpgrade,
        trialEndsAt: trialConfig.trialEndsAt ?? null,
        trialLengthDays: trialConfig.freeDays,
      });
      console.log("[API] scheduleInitialVisitForJob completed, firstVisit:", firstVisit?.id);
    } catch (error) {
      console.error("Auto scheduling failed, continuing without route assignment", error);
    }

    console.log("[API] Checking if firstVisit exists:", !!firstVisit);
    if (!firstVisit) {
      const fallbackDate = (() => {
        const base = preferredStart ? new Date(preferredStart) : addDays(startOfDay(now), 2);
        if (Number.isNaN(base.getTime())) {
          const safeDate = addDays(startOfDay(now), 2);
          safeDate.setHours(9, 0, 0, 0);
          return safeDate;
        }
        return base;
      })();
      if (fallbackDate < addDays(startOfDay(now), 2)) {
        const minStart = addDays(startOfDay(now), 2);
        fallbackDate.setTime(minStart.getTime());
      }
      if (normalizedTimeWindowSlug) {
        const startWindow = getPreferredTimeWindowStart(normalizedTimeWindowSlug);
        if (startWindow) {
          fallbackDate.setHours(startWindow.hour, startWindow.minute, 0, 0);
        }
      } else if (
        fallbackDate.getHours() === 0 &&
        fallbackDate.getMinutes() === 0
      ) {
        fallbackDate.setHours(9, 0, 0, 0);
      }

      console.log("[API] Creating service visit...");
      firstVisit = await prisma.serviceVisit.create({
        data: {
          orgId,
          customerId: customer.id,
          jobId: job.id,
          userId: user.id,
          scheduledDate: fallbackDate,
          status: ServiceStatus.SCHEDULED,
          serviceType: resolveServiceTypeFromFrequency(job.frequency),
          yardSize: resolveYardSize(lead.yardSize),
          dogsServiced: Math.max(1, lead.dogs ?? 1),
          metadata:
            visitMetadata == null
              ? Prisma.JsonNull
              : (visitMetadata as Prisma.InputJsonValue),
          preferredTimeWindow: normalizedTimeWindowLabel,
          preferredTimeWindowSlug: normalizedTimeWindowSlug,
          revenueCents: perVisitCents,
          tileId: validTileId,
        },
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          nextVisitAt: fallbackDate,
          preferredTimeWindow: normalizedTimeWindowLabel,
          preferredTimeWindowSlug: normalizedTimeWindowSlug,
        },
      });
    }

    if (activeTile) {
      // Fire-and-forget with timeout - don't block if Redis is unavailable
      console.log("[API] Enqueueing offer publishing (non-blocking)...");
      const offerTimeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
      Promise.race([
        enqueueOfferPublishing({
          orgId,
          tileSlugs: [activeTile.slug],
          lookaheadDays: 14,
          limitPerTile: 50,
        }),
        offerTimeout,
      ]).catch((err) => console.error("[API] enqueueOfferPublishing error:", err));
    }

    console.log("[API] Preparing pricing breakdown update...");
    const updatedPricingBreakdown = {
      ...(existingPricingBreakdown ?? {}),
      metadata: {
        ...((existingPricingBreakdown?.metadata as Record<string, any>) ?? {}),
        billingPreference: normalizedBillingPreference,
        ...(activeTile ? { serviceTileSlug: activeTile.slug } : {}),
        ...(normalizedTimeWindowLabel
          ? {
              preferredTimeWindow: normalizedTimeWindowLabel,
              ...(normalizedTimeWindowSlug
                ? { preferredTimeWindowSlug: normalizedTimeWindowSlug }
                : {}),
            }
          : {}),
        weekendUpgrade,
      },
    };

    const existingInstructionLines = (lead.specialInstructions ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 &&
          !specialInstructionPrefixes.some((prefix) =>
            line.toLowerCase().startsWith(prefix),
          ),
      );

    const arrivalLine = normalizedTimeWindowLabel
      ? `Preferred arrival window: ${normalizedTimeWindowLabel}`
      : null;

    const specialInstructions = [...existingInstructionLines, arrivalLine, ...uniqueAccessLines]
      .filter((line): line is string => Boolean(line && line.trim().length > 0))
      .join("\n")
      .trim();

    const conversionTimestamp = new Date();

    // Update lead with conversion info
    console.log("[API] Updating lead to WON status...");
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: "WON",
        convertedAt: conversionTimestamp,
        convertedToCustomerId: customer.id,
        preferredStartDate: firstVisit?.scheduledDate ?? preferredStart,
        pricingBreakdown: updatedPricingBreakdown,
        specialInstructions: specialInstructions || null,
      },
    });

    const leadEmailCandidates = Array.from(
      new Set([effectiveEmail, lead.email].filter((value): value is string => Boolean(value))),
    );

    if (leadEmailCandidates.length > 0) {
      await prisma.lead.updateMany({
        where: {
          orgId,
          id: { not: leadId },
          OR: leadEmailCandidates.map((email) => ({
            email: { equals: email, mode: "insensitive" },
          })),
        },
        data: {
          status: "WON",
          convertedAt: conversionTimestamp,
          convertedToCustomerId: customer.id,
        },
      });
    }

    console.log("[API] Lead updated successfully");

    // Send welcome email with sign-in link
    const siteUrl = getSiteUrl();
    const signInUrl = `${siteUrl}/signin?email=${encodeURIComponent(lead.email)}`;

    const firstVisitDateObject = firstVisit?.scheduledDate ?? preferredStart;
    const firstVisitDateLabel =
      formatServiceDate(firstVisitDateObject, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }) ?? "To be scheduled";

    const resolvedTimeWindowLabel = resolvePreferredTimeWindowShortLabel(
      normalizedTimeWindowSlug,
      normalizedTimeWindowLabel,
    );

    const firstVisitTimeLabel = resolvedTimeWindowLabel
      ? `${resolvedTimeWindowLabel} window`
      : "Flexible window";

    console.log("[API] Onboarding complete - about to send email");
    if (resend) {
      // Send email asynchronously - don't block the response
      // Use a fire-and-forget pattern with a short timeout
      const emailPromise = resend.emails.send({
        from: "InsightScoop <welcome@yardura.com>",
        to: lead.email,
        subject: `Welcome to InsightScoop, ${lead.firstName}! Your account is ready`,
        html: `
          <div style="margin:0;padding:32px 16px;background-color:#FAF7F1;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#1B1E23;">
            <div style="max-width:620px;margin:0 auto;background-color:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 24px 48px rgba(27,30,35,0.08);">
              <div style="text-align:center;padding:36px 24px;background-color:#F3645B;color:#FFF1DA;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.85;">InsightScoop</p>
                <h1 style="margin:0;font-size:28px;">Welcome to InsightScoop!</h1>
                <p style="margin:12px 0 0;font-size:16px;line-height:1.5;">Your account is live—here's what's ahead for your pup.</p>
              </div>

              <div style="padding:32px;line-height:1.6;font-size:15px;">
                <p style="margin:0 0 24px;">Hi ${lead.firstName},</p>
                <p style="margin:0 0 24px;">Thanks for joining InsightScoop! Your account is ready and your first visit is on the calendar. Here's a quick snapshot:</p>

                <div style="background-color:#FFF1DA;border:1px solid rgba(255,194,77,0.5);border-radius:18px;padding:24px;margin:0 0 24px;">
                  <h3 style="margin:0 0 12px;color:#204B36;">First visit details</h3>
                  <p style="margin:0;color:#475569;">
                    <strong>Date:</strong> ${firstVisitDateLabel}<br />
                    <strong>Time window:</strong> ${firstVisitTimeLabel}<br />
                    <strong>Address:</strong> ${lead.address}, ${lead.city}, ${lead.zipCode}
                  </p>
                </div>

                <div style="border:1px solid rgba(32,75,54,0.18);border-radius:18px;padding:24px;margin:0 0 24px;background-color:#FAF7F1;">
                  <h3 style="margin:0 0 10px;color:#204B36;">Access your dashboard</h3>
                  <p style="margin:0 0 18px;color:#475569;">Sign in with <strong>${lead.email}</strong> to manage visits, update payment details, and view wellness insights after every scoop.</p>
                  <div style="text-align:center;">
                    <a href="${signInUrl}" style="display:inline-block;padding:14px 28px;background-color:#F3645B;color:#FFF1DA;text-decoration:none;font-weight:600;border-radius:999px;">Send me a sign-in link</a>
                  </div>
                </div>

                <div style="text-align:center;margin:0 0 28px;">
                  <a href="${siteUrl}/dashboard" style="display:inline-block;padding:16px 34px;border-radius:999px;background-color:#204B36;color:#FAF7F1;text-decoration:none;font-weight:600;font-size:16px;">
                    Open my dashboard
                  </a>
                </div>

                <p style="margin:0 0 6px;color:#1B1E23;font-weight:600;">Need help?</p>
                <p style="margin:0;color:#475569;">Call <a href="tel:1-877-417-9273" style="color:#204B36;text-decoration:none;font-weight:600;">1-877-417-YARD</a> or reply to this email—we're happy to adjust visit notes, cadence, or add-ons.</p>
              </div>
            </div>
          </div>
        `,
      });
      
      // Don't await the email - let it complete in background with a timeout
      // This prevents the API from blocking for minutes if Resend is slow
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Email timeout")), 5000)
      );
      
      Promise.race([emailPromise, timeoutPromise])
        .then(() => console.log("[API] Email sent successfully"))
        .catch((emailError) => console.error("[API] Email send issue:", emailError));
      
      console.log("[API] Email queued (non-blocking)");
    } else {
      console.log("[API] Resend not configured, skipping email");
    }

    console.log("[API] Onboarding complete - sending response");
    return NextResponse.json({
      subscriptionId: null,
      customerId: customer.id,
      nextBillingDate:
        planPreference === "one-time"
          ? null
          : trialConfig.firstChargeAt?.toISOString() ?? null,
      firstVisitDate: firstVisitDateObject
        ? firstVisitDateObject.toISOString()
        : null,
      firstVisitTime: firstVisitTimeLabel,
      firstVisitTimeWindow: resolvedTimeWindowLabel ?? null,
      firstVisitTimeWindowSlug: normalizedTimeWindowSlug ?? null,
      serviceAddress: `${lead.address}, ${lead.city}, ${lead.zipCode}`,
    });
  } catch (error) {
    console.error("Onboarding completion error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to complete onboarding";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Main POST handler - timeout removed since operations are now non-blocking
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return await handleOnboardingComplete(request);
  } catch (error) {
    console.error("[API] POST handler caught error:", error);
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
