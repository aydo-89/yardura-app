import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractUserRole, getDefaultRedirectForRole } from "@/lib/auth/roles";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LeadActivityPanel } from "./LeadActivityPanel";

function formatCurrency(cents?: number | null) {
  if (typeof cents !== "number" || Number.isNaN(cents)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const AREA_LABELS: Record<string, string> = {
  frontYard: "Front yard",
  backYard: "Back yard",
  sideYard: "Side yard",
  dogRun: "Dog run",
  fencedArea: "Additional fenced area",
};

const CONTACT_METHOD_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone call",
  call: "Phone call",
  sms: "Text message",
  text: "Text message",
  linkedin: "LinkedIn",
  in_person: "In-person",
};

function extractLeadMetadata(raw: unknown) {
  const empty = {
    preferredStartDate: null as string | null,
    preferredContactMethods: null as string[] | null,
    howDidYouHear: null as string | null,
    salesRepName: null as string | null,
    specialRequests: null as string | null,
    marketingOptIn: null as boolean | null,
  };

  if (!raw) return empty;

  try {
    const parsed =
      typeof raw === "string" ? (JSON.parse(raw) as Record<string, any>) : (raw as Record<string, any>);
    const metadata = (parsed?.metadata ?? parsed ?? {}) as Record<string, any>;
    return {
      preferredStartDate: metadata?.preferredStartDate ?? null,
      preferredContactMethods: Array.isArray(metadata?.preferredContactMethods)
        ? (metadata.preferredContactMethods as string[])
        : metadata?.preferredContactMethods
        ? [String(metadata.preferredContactMethods)]
        : null,
      howDidYouHear: metadata?.howDidYouHear ?? null,
      salesRepName: metadata?.salesRepName ?? null,
      specialRequests: metadata?.specialRequests ?? null,
      marketingOptIn:
        typeof metadata?.marketingOptIn === "boolean" ? metadata.marketingOptIn : null,
    };
  } catch (error) {
    console.warn("Failed to parse lead metadata", error);
    return empty;
  }
}

function formatAreas(areas: unknown): string[] {
  if (!areas) return [];

  const labels: string[] = [];

  const pushLabel = (key: string, value: unknown) => {
    if (!value) return;
    if (typeof value === "boolean" && !value) return;
    if (key === "other" && typeof value === "string" && value.trim()) {
      labels.push(titleCase(value.trim()));
      return;
    }
    const label = AREA_LABELS[key] ?? titleCase(key.replace(/([a-z])([A-Z])/g, "$1 $2"));
    labels.push(label);
  };

  if (Array.isArray(areas)) {
    areas.forEach((entry) => {
      if (typeof entry === "string" && entry.trim()) {
        pushLabel(entry.trim(), true);
      } else if (entry && typeof entry === "object") {
        Object.entries(entry as Record<string, unknown>).forEach(([key, value]) =>
          pushLabel(key, value),
        );
      }
    });
  } else if (typeof areas === "object") {
    Object.entries(areas as Record<string, unknown>).forEach(([key, value]) =>
      pushLabel(key, value),
    );
  } else if (typeof areas === "string") {
    pushLabel(areas, true);
  }

  return Array.from(new Set(labels));
}

function formatPreferredMethods(methods: string[] | null | undefined): string[] {
  if (!methods?.length) return [];
  return Array.from(
    new Set(
      methods
        .map((method) => method.trim())
        .filter(Boolean)
        .map((method) => CONTACT_METHOD_LABELS[method.toLowerCase()] ?? titleCase(method.replace(/_/g, " "))),
    ),
  );
}

function formatDate(value?: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await safeGetServerSession(authOptions as any);

  if (!session?.user) {
    redirect(`/signin?callbackUrl=/admin/leads/${id}`);
  }

  const role = extractUserRole(session);
  const allowedRoles = new Set([
    "ADMIN",
    "OWNER",
    "SALES_REP",
    "SALES_MANAGER",
    "FRANCHISE_OWNER",
    "TECH",
  ]);

  if (!role || !allowedRoles.has(role)) {
    redirect(getDefaultRedirectForRole(role));
  }

  const orgId = (session.user as any)?.orgId ?? undefined;

  const lead = await prisma.lead.findFirst({
    where: {
      id,
      ...(orgId ? { orgId } : {}),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      salesRep: { select: { id: true, name: true, email: true } },
      territory: { select: { id: true, name: true, color: true } },
    },
  });

  if (!lead) {
    notFound();
  }

  const metadata = extractLeadMetadata(lead.pricingBreakdown);

  const preferredContactMethods = formatPreferredMethods(
    metadata.preferredContactMethods ?? null,
  );

  const areas = formatAreas(lead.areasToClean);

  const preferredStartDate = lead.preferredStartDate
    ? formatDate(lead.preferredStartDate)
    : metadata.preferredStartDate
    ? formatDate(metadata.preferredStartDate)
    : "—";

  const lastCleanedLabel = (() => {
    if (lead.lastCleanedBucket) {
      switch (lead.lastCleanedBucket) {
        case "14":
        case "14_days":
          return "Within 2 weeks";
        case "42":
        case "6_weeks":
          return "2–6 weeks";
        case "999":
        case "90_plus":
          return "6+ weeks";
        default:
          return titleCase(lead.lastCleanedBucket.replace(/_/g, " "));
      }
    }
    if (lead.daysSinceLastCleanup) {
      return `${lead.daysSinceLastCleanup} days ago`;
    }
    if (lead.lastCleanedDate) {
      return formatDate(lead.lastCleanedDate);
    }
    return "—";
  })();

  const statusBadgeTone = (() => {
    const statusValue = String(lead.status || "").toUpperCase();
    switch (statusValue) {
      case "NEW":
        return "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-100";
      case "CONTACTED":
        return "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100";
      case "QUALIFIED":
      case "PROPOSAL_SENT":
      case "NEGOTIATING":
        return "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100";
      case "WON":
        return "border border-brand-mint/30 bg-brand-mint/10 text-brand-mint dark:border-brand-mint/40 dark:bg-brand-mint/10 dark:text-brand-mint";
      case "LOST":
        return "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100";
      case "ARCHIVED":
        return "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300";
      default:
        return "border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200";
    }
  })();

  const priorityTone = (() => {
    const priorityValue = String(lead.priority || "").toUpperCase();
    switch (priorityValue) {
      case "HIGH":
        return "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/10 dark:text-rose-100";
      case "URGENT":
        return "border border-red-200 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-100";
      case "LOW":
        return "border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300";
      default:
        return "border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100";
    }
  })();

  const contactName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") ||
    lead.email;

  const ownerName = lead.owner?.name || lead.owner?.email || "Unassigned";
  const salesRepName = lead.salesRep?.name || lead.salesRep?.email || metadata.salesRepName;

  const pricingSnapshot = (() => {
    if (!lead.pricingBreakdown) return null;
    try {
      return typeof lead.pricingBreakdown === "string"
        ? JSON.parse(lead.pricingBreakdown)
        : lead.pricingBreakdown;
    } catch {
      return null;
    }
  })() as Record<string, any> | null;

  const resolvedMonthly = pricingSnapshot?.fullMonthlyAmount ?? pricingSnapshot?.monthly ?? null;
  const resolvedPerVisit = pricingSnapshot?.perVisit ?? null;
  const resolvedDueToday =
    pricingSnapshot?.amountDueToday ?? pricingSnapshot?.firstVisitTotalCents ?? null;

  const timelineStats = [
    {
      label: "Submitted",
      value: formatDate(lead.submittedAt),
    },
    {
      label: "Next action",
      value: formatDateTime(lead.nextActionAt),
    },
    {
      label: "Last activity",
      value: formatDateTime(lead.lastActivityAt),
    },
  ];

  const serviceStats = [
    { label: "Service type", value: titleCase(lead.serviceType || "residential") },
    { label: "Dogs", value: lead.dogs != null ? `${lead.dogs}` : "—" },
    {
      label: "Property size",
      value: lead.yardSize ? titleCase(lead.yardSize) : "—",
    },
    {
      label: "Preferred cadence",
      value: lead.frequency ? titleCase(lead.frequency) : "—",
    },
    { label: "Last cleaned", value: lastCleanedLabel },
  ];

  const addressLine = [lead.address, lead.city, lead.state, lead.zipCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="admin-surface min-h-screen">
      <div className="container mx-auto space-y-6 px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white">
                {contactName}
              </h1>
              <Badge className={statusBadgeTone}>{titleCase(lead.status)}</Badge>
              {lead.pipelineStage ? (
                <Badge
                  variant="outline"
                  className="border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-200"
                >
                  {titleCase(lead.pipelineStage.replace(/_/g, " "))}
                </Badge>
              ) : null}
              <Badge className={priorityTone}>{titleCase(lead.priority)}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span>Lead #{lead.id.slice(-8).toUpperCase()}</span>
              <span>Submitted {formatDateTime(lead.submittedAt)}</span>
              {metadata.howDidYouHear ? <span>Source: {metadata.howDidYouHear}</span> : null}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-300">
              {lead.email ? <span>Email: {lead.email}</span> : null}
              {lead.phone ? <span>Phone: {lead.phone}</span> : null}
              {preferredContactMethods.length ? (
                <span>Preferred contact: {preferredContactMethods.join(", ")}</span>
              ) : lead.preferredContactMethod ? (
                <span>Preferred contact: {titleCase(lead.preferredContactMethod)}</span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/leads"
              className="text-sm text-brand-coral transition hover:text-brand-coral/80 dark:text-brand-mint dark:hover:text-brand-mint/80"
            >
              ← Back to leads
            </Link>
            {lead.convertedToCustomerId ? (
              <Link
                href={`/admin/customers/${lead.convertedToCustomerId}`}
                className="text-sm text-brand-coral transition hover:text-brand-coral/80 dark:text-brand-mint dark:hover:text-brand-mint/80"
              >
                View customer record →
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="admin-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg text-slate-900 dark:text-white">
                Lead snapshot
              </CardTitle>
              <CardDescription>
                Core service details captured during the quote flow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
              {serviceStats.map((item) => (
                <div key={item.label}>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                    {item.value}
                  </p>
                </div>
              ))}
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Preferred start date
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {preferredStartDate}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Assigned rep
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {salesRepName ? titleCase(salesRepName) : "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Lead owner
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {ownerName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Territory
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                  {lead.territory?.name ?? "—"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Service address
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {addressLine || "—"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Areas to clean
                </p>
                {areas.length ? (
                  <div className="flex flex-wrap gap-2">
                    {areas.map((area) => (
                      <Badge
                        key={area}
                        variant="outline"
                        className="border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200"
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-300">Not specified</p>
                )}
              </div>
            </div>

            {metadata.specialRequests || lead.specialInstructions ? (
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900/40">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Special instructions
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                  {metadata.specialRequests || lead.specialInstructions}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">
              Timeline
            </CardTitle>
            <CardDescription>Key timestamps and next steps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {timelineStats.map((stat) => (
              <div key={stat.label}>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">{stat.value}</p>
              </div>
            ))}
            {metadata.marketingOptIn !== null ? (
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Marketing consent
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {metadata.marketingOptIn ? "Opted in" : "Opted out"}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="admin-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">
              Quote snapshot
            </CardTitle>
            <CardDescription>
              Pricing captured when the lead submitted their quote.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Monthly membership
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(resolvedMonthly)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Pay-per-visit
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(resolvedPerVisit)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Due today (initial)
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {formatCurrency(resolvedDueToday)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="admin-card">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-white">
              Referrals & origin
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                How did they hear about us?
              </p>
              <p className="mt-1 font-medium text-slate-900 dark:text-white">
                {metadata.howDidYouHear || lead.referralSource || "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

        <LeadActivityPanel leadId={lead.id} />
      </div>
    </div>
  );
}
