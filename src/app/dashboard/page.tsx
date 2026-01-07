import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { redirect } from "next/navigation";
import { safeGetServerSession, authOptions } from "@/lib/auth";
import Dashboard from "@/components/dashboard/Dashboard";
import UserLayout from "@/components/layout/UserLayout";
import type { Prisma } from "@prisma/client";
import type {
  User as DashboardUser,
  Dog as DashboardDog,
  DashboardServiceVisit,
  DashboardDataReading,
} from "@/components/dashboard/types";
import {
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowShortLabel,
} from "@/lib/time-window";
import { env } from "@/lib/env";
import { createSignedUrl } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

async function resolveStorageUrl(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  if (!env.STORAGE_BUCKET) return null;
  try {
    return await createSignedUrl(env.STORAGE_BUCKET, value, 60 * 60 * 24);
  } catch {
    return null;
  }
}

function resolveTrialDays(rawFrequency?: string | null): number {
  if (!rawFrequency) return 0;
  const normalized = String(rawFrequency)
    .toLowerCase()
    .replace(/_/g, "-")
    .trim();

  switch (normalized) {
    case "weekly":
    case "twice-weekly":
    case "twice weekly":
      return 7;
    case "bi-weekly":
    case "biweekly":
    case "every-other-week":
    case "every other week":
      return 14;
    case "monthly":
      return 30;
    case "one-time":
    case "onetime":
    case "one time":
      return 0;
    default:
      return 7;
  }
}

function parseMetadata(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function parseDateInput(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed;
    }
  }
  return null;
}

const leadSelect = {
  id: true,
  dogs: true,
  yardSize: true,
  frequency: true,
  preferredStartDate: true,
  specialInstructions: true,
  deodorizeMode: true,
  divertMode: true,
  referralSource: true,
  areasToClean: true,
  pricingBreakdown: true,
  convertedToCustomerId: true,
  submittedAt: true,
  salesRepId: true,
  address: true,
  city: true,
  zipCode: true,
} as const;

type LeadRecordSummary = Prisma.LeadGetPayload<{ select: typeof leadSelect }>;

const jobSelect = {
  id: true,
  createdAt: true,
  frequency: true,
  deodorizeMode: true,
  nextVisitAt: true,
  perVisitRevenueCents: true,
  stripeSubscriptionId: true,
} as const;

type JobRecordSummary = Prisma.JobGetPayload<{ select: typeof jobSelect }>;

const customerSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  addressLine1: true,
  city: true,
  state: true,
  zip: true,
  userId: true,
} as const;

type CustomerRecordSummary = Prisma.CustomerGetPayload<{
  select: typeof customerSelect;
}>;

const userInclude = {
  customer: {
    select: customerSelect,
  },
  dogs: true,
  serviceVisits: {
    orderBy: { scheduledDate: "desc" },
    take: 20,
    include: {
      media: {
        orderBy: { capturedAt: "asc" },
      },
      insights: true,
      communications: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  },
  dataReadings: {
    orderBy: { timestamp: "desc" },
    take: 100,
  },
} as const;

export default async function DashboardPage() {
  // Get authenticated user session using the shared authOptions
  const session = await safeGetServerSession(authOptions);

  console.log("[Dashboard] Session check:", {
    hasSession: !!session,
    hasUser: !!session?.user,
    email: session?.user?.email,
    role: (session as any)?.userRole,
  });

  if (!session?.user?.email) {
    console.log("[Dashboard] No session/email, redirecting to signin");
    redirect("/signin?callbackUrl=/dashboard");
  }

  // Use activeRole (user's selected view) not userRole (base database role)
  // This allows multi-role users to switch between customer and other views
  const activeRole = (session as any).activeRole;
  const userRole = (session as any).userRole;
  console.log("[Dashboard] User role:", userRole, "Active role:", activeRole);
  
  // Only redirect away if activeRole is NOT customer
  // If activeRole is CUSTOMER or undefined, they want the customer dashboard
  if (activeRole && activeRole !== "CUSTOMER") {
    if (activeRole === "ADMIN" || activeRole === "OWNER") {
      console.log("[Dashboard] Admin/Owner active role, redirecting to /admin");
      redirect("/admin");
    }
    
    if (activeRole === "TECH") {
      console.log("[Dashboard] Tech active role, redirecting to /field-tech");
      redirect("/field-tech");
    }

    if (activeRole === "SALES_REP") {
      console.log("[Dashboard] Sales rep active role, redirecting to /admin/leads");
      redirect("/admin/leads");
    }
  }

  type PrismaUserWithRelations = Prisma.UserGetPayload<{
    include: typeof userInclude;
  }>;

  let user: PrismaUserWithRelations | null = null;
  let leadRecord: LeadRecordSummary | null = null;
  let jobRecord: JobRecordSummary | null = null;
  let customerRecord: CustomerRecordSummary | null = null;
  let userCreatedAt: Date | null = null;
  let billingPlanRecord:
    | {
        billingPreference: string | null;
        metadata: Prisma.JsonValue | null;
        trialEndsAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }
    | null = null;

  type DogRecord = {
    id: string;
    name: string;
    breed: string | null;
    age: number | null;
    weight: number | null;
    photoUrl: string | null;
  };
  type ServiceVisitRecord = {
    id: string;
    scheduledDate: Date;
    status: string;
    serviceType: string;
    yardSize: string;
    preferredTimeWindow?: string | null;
    preferredTimeWindowSlug?: string | null;
    jobId: string;
    media: Array<{
      id: string;
      assetType: string;
      capturedAt: Date;
      analysisStatus: string;
      analysisModel: string | null;
      analysisConfidence: number | null;
      analysisResult: Record<string, unknown> | null;
      stoolSampleId: string | null;
      stoolSampleView: string | null;
    }>;
    insights: Array<{
      colorIndicator: string;
      consistencyIndicator: string;
      contentIndicator: string;
      observations: string | null;
      wellnessFlag: boolean;
      flagReason: string | null;
      source: string;
      sourceMediaId: string | null;
      autoConfidence: number | null;
      analysisModel: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    communications: Array<{
      id: string;
      channel: string;
      status: string;
      messageBody: string;
      sentAt: Date | null;
      statusDetail: string | null;
    }>;
  };
  type DataReadingRecord = {
    id: string;
    timestamp: Date;
    weight: number | null;
    volume: number | null;
    color: string | null;
    consistency: string | null;
    location: string | null;
  };

  let clientUser: DashboardUser = {
    id: ((session.user as any)?.id as string | undefined) ?? "pending-user",
    email: session.user.email,
    name: session.user.name ?? null,
  };
  let clientDogs: DashboardDog[] = [];
  let clientServiceVisits: DashboardServiceVisit[] = [];
  let clientDataReadings: DashboardDataReading[] = [];

  try {
      // Load real user data from database
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: userInclude,
      });

      if (!user) {
        // User not found in database, redirect to signin
        redirect("/signin?callbackUrl=/dashboard");
      }

      if (user.customer) {
        customerRecord = user.customer;
      }

      leadRecord = await prisma.lead.findFirst({
        where: { email: session.user.email },
        orderBy: [
          { convertedAt: "desc" },
          { submittedAt: "desc" },
        ],
        select: leadSelect,
      });

      if (!customerRecord && leadRecord?.convertedToCustomerId) {
        customerRecord = await prisma.customer.findUnique({
          where: { id: leadRecord.convertedToCustomerId },
          select: customerSelect,
        });
      }

      if (!customerRecord) {
        customerRecord = await prisma.customer.findFirst({
          where: {
            email: session.user.email,
            orgId: "yardura",
          },
          orderBy: { createdAt: "desc" },
          select: customerSelect,
        });
      }

      if (customerRecord?.id) {
        if (!leadRecord || leadRecord.convertedToCustomerId !== customerRecord.id) {
          const convertedLead = await prisma.lead.findFirst({
            where: { convertedToCustomerId: customerRecord.id },
            orderBy: [
              { convertedAt: "desc" },
              { submittedAt: "desc" },
            ],
            select: leadSelect,
          });

          if (convertedLead) {
            leadRecord = convertedLead;
          }
        }
      }

      const resolvedCustomerId =
        leadRecord?.convertedToCustomerId || customerRecord?.id || null;

      if (resolvedCustomerId) {
        jobRecord = await prisma.job.findFirst({
          where: { customerId: resolvedCustomerId },
          orderBy: { createdAt: "desc" },
          select: jobSelect,
        });

        try {
          billingPlanRecord = await prisma.customerBillingPlan.findFirst({
            where: { customerId: resolvedCustomerId },
            orderBy: { createdAt: "desc" },
            select: {
              billingPreference: true,
              metadata: true,
              trialEndsAt: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        } catch (error: any) {
          if (error?.code === "P2021") {
            billingPlanRecord = null;
          } else {
            throw error;
          }
        }
      }
  } catch (error) {
    console.error("Error loading user data:", error);
    redirect("/signin?callbackUrl=/dashboard");
  }

  // Prepare serializable props for client component
  let firstScheduledVisit: Date | null = null;
  let nextScheduledVisit: Date | null = null;
  let billingPreference: string | null = null;
  let trialAnchor: Date | null = null;

  if (!user) {
    // This should never happen since we redirect if user is not found
    throw new Error("User not found");
  }

  const areasToCleanList = (() => {
    if (!leadRecord?.areasToClean) return null;
    try {
      const raw = leadRecord.areasToClean as unknown as Record<string, unknown>;
      return Object.entries(raw)
        .filter(([, value]) => Boolean(value))
        .map(([key]) =>
          key
            .split(/[_-]/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" "),
        );
    } catch (error) {
      console.warn("dashboard: unable to parse areasToClean", error);
      return null;
    }
  })();

  let serviceVisitsRecords =
    ((user as any).serviceVisits as ServiceVisitRecord[]) || [];

  if (customerRecord?.id) {
    const customerServiceVisits = (await prisma.serviceVisit.findMany({
      where: { customerId: customerRecord.id },
      orderBy: { scheduledDate: "desc" },
      take: 40,
      include: {
        media: {
          orderBy: { capturedAt: "asc" },
        },
        insights: true,
        communications: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })) as ServiceVisitRecord[];

    if (customerServiceVisits.length) {
      const visitMap = new Map<string, ServiceVisitRecord>();
      for (const visit of serviceVisitsRecords) {
        visitMap.set(visit.id, visit);
      }
      for (const visit of customerServiceVisits) {
        visitMap.set(visit.id, visit);
      }
      serviceVisitsRecords = Array.from(visitMap.values()).sort(
        (a, b) =>
          new Date(b.scheduledDate).getTime() -
          new Date(a.scheduledDate).getTime(),
      );
    }
  }

  if (jobRecord?.id) {
    const jobScopedVisits = serviceVisitsRecords.filter(
      (visit) => visit.jobId === jobRecord.id,
    );
    if (jobScopedVisits.length) {
      serviceVisitsRecords = jobScopedVisits as ServiceVisitRecord[];
    }
  }
  const hasAnyVisits = serviceVisitsRecords.length > 0;

  nextScheduledVisit = serviceVisitsRecords
    .filter((visit) => visit.status === "SCHEDULED")
    .map((visit) => visit.scheduledDate)
    .sort((a, b) => a.getTime() - b.getTime())[0] || null;

  firstScheduledVisit = serviceVisitsRecords.length
    ? serviceVisitsRecords
        .map((visit) => visit.scheduledDate)
        .sort((a, b) => a.getTime() - b.getTime())[0]
    : null;

  const preferredStartFromLead = leadRecord?.preferredStartDate
    ? new Date(leadRecord.preferredStartDate)
    : null;

  const jobNextVisit = jobRecord?.nextVisitAt
    ? new Date(jobRecord.nextVisitAt)
    : null;

  if (!firstScheduledVisit && preferredStartFromLead) {
    firstScheduledVisit = preferredStartFromLead;
  }

  if (!nextScheduledVisit && preferredStartFromLead && !hasAnyVisits && !jobNextVisit) {
    const anchorTime = preferredStartFromLead.getTime();
    const now = Date.now();
    if (anchorTime >= now || now - anchorTime <= 7 * DAY_MS) {
      nextScheduledVisit = preferredStartFromLead;
    }
  }

  if (!firstScheduledVisit && jobNextVisit) {
    firstScheduledVisit = jobNextVisit;
  }

  if (!nextScheduledVisit && jobNextVisit) {
    nextScheduledVisit = jobNextVisit;
  }

  const pricingMetadata =
    typeof leadRecord?.pricingBreakdown === "object" &&
    leadRecord?.pricingBreakdown !== null
      ? ((leadRecord.pricingBreakdown as Record<string, unknown>)
          .metadata as Record<string, unknown> | undefined)
      : undefined;

  const pricingSnapshot = (() => {
    if (!leadRecord?.pricingBreakdown) return null;
    if (typeof leadRecord.pricingBreakdown === "string") {
      try {
        return JSON.parse(leadRecord.pricingBreakdown) as Record<string, unknown>;
      } catch (error) {
        console.warn("dashboard: unable to parse pricingBreakdown", error);
        return null;
      }
    }
    if (typeof leadRecord.pricingBreakdown === "object") {
      return leadRecord.pricingBreakdown as Record<string, unknown>;
    }
    return null;
  })();

  const normalizeCents = (value: unknown): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") {
      if (Number.isInteger(value)) return value;
      return Math.round(value * 100);
    }
    const trimmed = String(value).trim();
    if (!trimmed) return 0;
    const parsed = Number.parseFloat(trimmed);
    if (!Number.isFinite(parsed)) return 0;
    return trimmed.includes(".") ? Math.round(parsed * 100) : Math.round(parsed);
  };

  const toNumber = (value: unknown): number => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Number.parseFloat(String(value ?? ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const perVisitCents = (() => {
    const candidate = normalizeCents(pricingSnapshot?.perVisit);
    if (candidate > 0) return candidate;
    if (typeof jobRecord?.perVisitRevenueCents === "number") {
      return jobRecord.perVisitRevenueCents;
    }
    return null;
  })();

  const visitsPerMonth = toNumber(pricingSnapshot?.visitsPerMonth);
  const monthlyCentsCandidate = normalizeCents(
    pricingSnapshot?.fullMonthlyAmount ?? pricingSnapshot?.monthly,
  );
  const computedMonthlyCents =
    perVisitCents && visitsPerMonth > 0
      ? Math.round(perVisitCents * visitsPerMonth)
      : 0;
  const monthlyCents =
    monthlyCentsCandidate > 0
      ? monthlyCentsCandidate
      : computedMonthlyCents > 0
        ? computedMonthlyCents
        : null;

  const planMetadata = parseMetadata(billingPlanRecord?.metadata ?? null);
  const serviceOptions =
    planMetadata &&
    typeof planMetadata.serviceOptions === "object" &&
    !Array.isArray(planMetadata.serviceOptions)
      ? (planMetadata.serviceOptions as Record<string, unknown>)
      : null;
  const billingAutomation =
    planMetadata &&
    typeof planMetadata.billingAutomation === "object" &&
    !Array.isArray(planMetadata.billingAutomation)
      ? (planMetadata.billingAutomation as Record<string, unknown>)
      : null;
  const weekendUpgrade = Boolean(serviceOptions?.weekendUpgrade);
  const trialStartsAtDate =
    parseDateInput(billingAutomation?.trialStartsAt) ??
    parseDateInput(billingAutomation?.activationStartsAt);
  const activationStartsAtDate = parseDateInput(
    billingAutomation?.activationStartsAt,
  );
  const firstChargeAtDate = parseDateInput(billingAutomation?.firstChargeAt);

  billingPreference =
    billingPlanRecord?.billingPreference ??
    (() => {
      const raw =
        pricingMetadata?.billingPreference || pricingMetadata?.serviceBilling;
      return raw ? String(raw) : null;
    })();

  const rawPreferredTimeWindowLabel =
    typeof pricingMetadata?.preferredTimeWindow === "string"
      ? pricingMetadata.preferredTimeWindow
      : null;
  const preferredTimeWindowSlugRaw =
    typeof pricingMetadata?.preferredTimeWindowSlug === "string"
      ? pricingMetadata.preferredTimeWindowSlug
      : null;

  const preferredTimeWindowSlug = normalizePreferredTimeWindowSlug(
    preferredTimeWindowSlugRaw,
  );
  const preferredTimeWindowShortLabel =
    resolvePreferredTimeWindowShortLabel(
      preferredTimeWindowSlug,
      rawPreferredTimeWindowLabel,
    ) ?? null;
  const preferredTimeWindowLabel = preferredTimeWindowShortLabel
    ? `${preferredTimeWindowShortLabel} window`
    : null;

  const normalizeFrequency = (value?: string | null) => {
    if (!value) return null;
    return value.toString().toLowerCase().replace(/_/g, "-");
  };

  const normalizeDeodorize = (value?: string | null) => {
    if (!value) return null;
    return value.toString().toLowerCase().replace(/_/g, "-");
  };

  const normalizeDivertMode = (value?: string | null) => {
    if (!value) return null;
    return value.toString().toLowerCase().replace(/_/g, "-");
  };

  const normalizedFrequency = normalizeFrequency(
    leadRecord?.frequency ?? jobRecord?.frequency ?? null,
  );

  const resolvedDogsCount = (() => {
    if (typeof leadRecord?.dogs === "number" && leadRecord.dogs > 0) {
      return leadRecord.dogs;
    }
    const metaDogs = pricingMetadata?.dogs;
    if (typeof metaDogs === "number" && metaDogs > 0) {
      return metaDogs;
    }
    const userDogs = Array.isArray((user as any).dogs)
      ? ((user as any).dogs as DogRecord[]).length
      : null;
    return userDogs && userDogs > 0 ? userDogs : null;
  })();

  userCreatedAt = user.createdAt;

  const resolvedAddress =
    user.address || leadRecord?.address || customerRecord?.addressLine1 || null;
  const resolvedCity = user.city || leadRecord?.city || customerRecord?.city || null;
  const resolvedZip = user.zipCode || leadRecord?.zipCode || customerRecord?.zip || null;
  const resolvedPhone = user.phone || customerRecord?.phone || null;
  const resolvedName = user.name || customerRecord?.name || null;
  const resolvedImage = await resolveStorageUrl(user.image ?? null);

  clientUser = {
    id: user.id,
    name: resolvedName,
    image: resolvedImage,
    email: user.email,
    phone: resolvedPhone,
    address: resolvedAddress,
    city: resolvedCity,
    zipCode: resolvedZip,
    stripeCustomerId: user.stripeCustomerId,
    orgId: user.orgId || null,
    dogsCount: resolvedDogsCount,
    yardSize: leadRecord?.yardSize ?? null,
    serviceFrequency: normalizedFrequency,
    firstServiceDate: firstScheduledVisit
      ? firstScheduledVisit.toISOString()
      : preferredStartFromLead
        ? preferredStartFromLead.toISOString()
        : null,
    serviceAreas: areasToCleanList,
    specialInstructions: leadRecord?.specialInstructions ?? null,
    preferredTime: preferredTimeWindowLabel ?? null,
    preferredTimeWindowSlug: preferredTimeWindowSlug ?? null,
  } satisfies DashboardUser;

  const rawDogs = (user as any).dogs as DogRecord[] | undefined;
  clientDogs = rawDogs
    ? await Promise.all(
        rawDogs.map(async (d) => ({
          id: d.id,
          name: d.name,
          breed: d.breed,
          age: d.age,
          weight: d.weight,
          photoUrl: await resolveStorageUrl(d.photoUrl ?? null),
        })),
      )
    : [];

  clientServiceVisits = serviceVisitsRecords.map((v: ServiceVisitRecord) => ({
    id: v.id,
    scheduledDate: v.scheduledDate.toISOString(),
    status: v.status,
    serviceType: v.serviceType,
    yardSize: v.yardSize,
    preferredTimeWindow: v.preferredTimeWindow ?? null,
    preferredTimeWindowSlug: v.preferredTimeWindowSlug ?? null,
    media: v.media?.map((m) => ({
      id: m.id,
      assetType: m.assetType,
      capturedAt: m.capturedAt.toISOString(),
      analysisStatus: m.analysisStatus,
      analysisModel: m.analysisModel,
      analysisConfidence: m.analysisConfidence ?? null,
      analysisResult: (m.analysisResult as Record<string, unknown> | null) ?? null,
      stoolSampleId: m.stoolSampleId ?? null,
      stoolSampleView: m.stoolSampleView ?? null,
    })),
    insight: v.insights?.[0]
      ? {
          colorIndicator: v.insights[0].colorIndicator,
          consistencyIndicator: v.insights[0].consistencyIndicator,
          contentIndicator: v.insights[0].contentIndicator,
          observations: v.insights[0].observations,
          wellnessFlag: v.insights[0].wellnessFlag,
          flagReason: v.insights[0].flagReason,
          source: v.insights[0].source,
          sourceMediaId: v.insights[0].sourceMediaId,
          autoConfidence: v.insights[0].autoConfidence ?? null,
          analysisModel: v.insights[0].analysisModel ?? null,
        }
      : null,
  })) as DashboardServiceVisit[];

  clientDataReadings =
    ((user as any).dataReadings as DataReadingRecord[] | undefined)?.map((r) => {
      let issues: string[] = [];
      if (typeof r.location === "string" && r.location.trim().length) {
        try {
          const parsed = JSON.parse(r.location);
          if (parsed && Array.isArray(parsed.issues)) {
            issues = parsed.issues.filter(
              (value: unknown): value is string => typeof value === "string" && value.trim().length > 0,
            );
          }
        } catch (_err) {
          // ignore malformed metadata
        }
      }

      return {
        id: r.id,
        timestamp: r.timestamp.toISOString(),
        weight: r.weight,
        volume: r.volume,
        color: r.color,
        consistency: r.consistency,
        consistencyLabel: r.consistency,
        issues,
      } satisfies DashboardDataReading;
    }) || [];

  trialAnchor =
    trialStartsAtDate || leadRecord?.submittedAt || userCreatedAt;

  const resolvedFrequency =
    leadRecord?.frequency ?? (jobRecord?.frequency ? String(jobRecord.frequency) : null);
  const trialDurationDays = resolveTrialDays(resolvedFrequency);

  const computedTrialEndsAtDate =
    trialAnchor && trialDurationDays > 0
      ? new Date(new Date(trialAnchor).getTime() + trialDurationDays * DAY_MS)
      : null;
  const planTrialEndsAtDate = billingPlanRecord?.trialEndsAt ?? null;
  const trialEndsDate = planTrialEndsAtDate ?? computedTrialEndsAtDate;
  const trialEndsAt = trialEndsDate ? trialEndsDate.toISOString() : null;

  let subscriptionStatus: string | null = null;
  let nextBillingIso: string | null = null;

  if (jobRecord?.stripeSubscriptionId) {
    try {
      const subscription = (await stripe.subscriptions.retrieve(
        jobRecord.stripeSubscriptionId,
        {
          expand: ["items.data.price"],
        },
      )) as Stripe.Subscription;

      subscriptionStatus = subscription.status;

      const price = subscription.items.data[0]?.price;
      if (!billingPreference && price?.recurring?.interval) {
        const interval = price.recurring.interval;
        if (interval === "month") {
          billingPreference = "monthly";
        } else if (interval === "week") {
          billingPreference = "weekly";
        }
      }

      const candidateDates: Date[] = [];

      try {
        const upcomingInvoice = await stripe.invoices.createPreview({
          customer:
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer.id,
          subscription: subscription.id,
        });

        if (upcomingInvoice?.due_date) {
          candidateDates.push(new Date(upcomingInvoice.due_date * 1000));
        } else if (upcomingInvoice?.next_payment_attempt) {
          candidateDates.push(
            new Date(upcomingInvoice.next_payment_attempt * 1000),
          );
        } else if (upcomingInvoice?.created) {
          candidateDates.push(new Date(upcomingInvoice.created * 1000));
        }
      } catch (upcomingError) {
        console.warn("dashboard: unable to retrieve upcoming invoice", upcomingError);
      }

      if (subscription.trial_end) {
        candidateDates.push(new Date(subscription.trial_end * 1000));
      }

      if (candidateDates.length) {
        candidateDates.sort((a, b) => a.getTime() - b.getTime());
        nextBillingIso = candidateDates[0].toISOString();
      }
    } catch (error) {
      console.warn("dashboard: unable to retrieve subscription details", error);
    }
  }

  if (!nextBillingIso) {
    if (firstChargeAtDate) {
      nextBillingIso = firstChargeAtDate.toISOString();
    }
  }

  if (!nextBillingIso) {
    if (jobNextVisit) {
      nextBillingIso = jobNextVisit.toISOString();
    } else if (nextScheduledVisit) {
      nextBillingIso = nextScheduledVisit.toISOString();
    }
  }

  if (!billingPreference) {
    billingPreference = normalizedFrequency && normalizedFrequency.includes("weekly")
      ? "weekly"
      : "monthly";
  }


  const serviceSummary = {
    planName: normalizedFrequency
      ? normalizedFrequency.replace(/-/g, " ")
      : null,
    frequency: normalizedFrequency,
    yardSize: leadRecord?.yardSize ?? null,
    dogsCount: resolvedDogsCount ?? (clientDogs.length || null),
    billingPreference,
    perVisitCents,
    monthlyCents,
    startDate: jobRecord?.createdAt
      ? jobRecord.createdAt.toISOString()
      : trialAnchor
        ? new Date(trialAnchor).toISOString()
        : null,
    firstVisitDate: firstScheduledVisit
      ? firstScheduledVisit.toISOString()
      : preferredStartFromLead
        ? preferredStartFromLead.toISOString()
        : jobNextVisit
          ? jobNextVisit.toISOString()
          : null,
    nextVisitDate: nextScheduledVisit
      ? nextScheduledVisit.toISOString()
      : jobNextVisit
        ? jobNextVisit.toISOString()
        : !hasAnyVisits && preferredStartFromLead
          ? preferredStartFromLead.toISOString()
          : null,
    nextBillingDate: nextBillingIso,
    subscriptionStatus,
    trialEndsAt,
    trialStartsAt: trialStartsAtDate ? trialStartsAtDate.toISOString() : null,
    firstChargeAt: firstChargeAtDate ? firstChargeAtDate.toISOString() : null,
    billingActivationAt: activationStartsAtDate
      ? activationStartsAtDate.toISOString()
      : null,
    weekendCoverage:
      normalizedFrequency === "daily"
        ? weekendUpgrade
          ? "Mon–Sun"
          : "Mon–Fri"
        : null,
    weekendUpgrade,
    specialInstructions: leadRecord?.specialInstructions ?? null,
    deodorizeMode: normalizeDeodorize(
      jobRecord?.deodorizeMode ?? leadRecord?.deodorizeMode ?? null,
    ),
    divertMode: normalizeDivertMode(leadRecord?.divertMode ?? null),
    referralSource: leadRecord?.referralSource ?? null,
    preferredTimeWindow: preferredTimeWindowLabel ?? null,
    preferredTimeWindowSlug: preferredTimeWindowSlug ?? null,
  };

  return (
    <UserLayout>
      <div className="container py-4 pt-10">
        <Dashboard
          user={clientUser}
          dogs={clientDogs}
          serviceVisits={clientServiceVisits}
          dataReadings={clientDataReadings}
          serviceSummary={serviceSummary}
        />
      </div>
    </UserLayout>
  );
}
