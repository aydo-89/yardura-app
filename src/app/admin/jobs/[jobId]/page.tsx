import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

import { authOptions } from "@/lib/auth";
import { safeGetServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SERVICE_TIME_ZONE } from "@/lib/time-window";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { JobVisitManager } from "@/components/admin/JobVisitManager";

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: SERVICE_TIME_ZONE,
  }).format(date);
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const session = await safeGetServerSession(authOptions as any);
  if (!session?.user) {
    redirect(`/signin?callbackUrl=/admin/jobs/${jobId}`);
  }

  // Default to "yardura" org - supports multi-tenancy while keeping a sensible default
  const orgId = (session.user as any)?.orgId || "yardura";

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      orgId,
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
        },
      },
      serviceVisits: {
        orderBy: { scheduledDate: "asc" },
        include: {
          assignedTo: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!job) {
    notFound();
  }

  const visits = job.serviceVisits.map((visit) => ({
    id: visit.id,
    scheduledDate: visit.scheduledDate.toISOString(),
    status: visit.status,
    preferredTimeWindowSlug: visit.preferredTimeWindowSlug,
    preferredTimeWindow: visit.preferredTimeWindow,
    assignedTo: visit.assignedTo
      ? { id: visit.assignedTo.id, name: visit.assignedTo.name }
      : null,
  }));

  const now = new Date();
  const upcomingCount = job.serviceVisits.filter(
    (visit) => visit.scheduledDate.getTime() >= now.getTime() && visit.status !== "CANCELLED",
  ).length;
  const completedCount = job.serviceVisits.filter(
    (visit) => visit.status === "COMPLETED",
  ).length;

  const jobSummary = {
    id: job.id,
    frequency: job.frequency,
    status: job.status,
    dayOfWeek: job.dayOfWeek,
    nextVisitAt: job.nextVisitAt ? job.nextVisitAt.toISOString() : null,
    preferredTimeWindow: job.preferredTimeWindow ?? null,
    stripeSubscriptionId: job.stripeSubscriptionId ?? null,
    createdAt: job.createdAt ? job.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: job.createdAt ? job.createdAt.toISOString() : new Date().toISOString(),
    customer: {
      id: job.customer.id,
      name: job.customer.name ?? "Customer",
      email: job.customer.email,
      phone: job.customer.phone,
    },
  };

  return (
    <div className="admin-surface min-h-screen">
      <header className="border-b border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
        <div className="container mx-auto px-6 pb-12 pt-20">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="admin-kicker">Job record</div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-serif text-3xl font-semibold text-slate-900 dark:text-white">
                    Job {job.id}
                  </h1>
                  <Badge className={job.status === "ACTIVE" ? "bg-brand-mint text-white" : ""}>
                    {job.status.toLowerCase()}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-200"
                  >
                    {job.frequency.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Linked customer:{" "}
                  <Link
                    href={`/admin/customers/${job.customer.id}`}
                    className="font-medium text-slate-900 hover:underline dark:text-white"
                  >
                    {job.customer.name || job.customer.email || job.customer.id}
                  </Link>
                </p>
                {jobSummary.nextVisitAt ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Next visit {formatDate(new Date(jobSummary.nextVisitAt))} •{" "}
                    {formatDistanceToNow(new Date(jobSummary.nextVisitAt), {
                      addSuffix: true,
                    })}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No upcoming visit scheduled</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-6 pb-24 pt-12">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="admin-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Stripe subscription</CardTitle>
              <CardDescription>Status & recurring billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>ID</span>
                <span className="font-mono text-xs">
                  {jobSummary.stripeSubscriptionId || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Created</span>
                <span>{formatDate(new Date(jobSummary.createdAt))}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Visit cadence</CardTitle>
              <CardDescription>Day & preferred window</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Preferred window</span>
                <span>{jobSummary.preferredTimeWindow ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Cadence anchor</span>
                <span>
                  {typeof jobSummary.dayOfWeek === "number"
                    ? getWeekdayLabel(jobSummary.dayOfWeek)
                    : "—"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="admin-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Visit counts</CardTitle>
              <CardDescription>History snapshot</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Upcoming</span>
                <span>{upcomingCount}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Completed</span>
                <span>{completedCount}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator className="bg-slate-200 dark:bg-slate-800" />

        <JobVisitManager
          job={jobSummary}
          visits={visits}
          timeZone={SERVICE_TIME_ZONE}
        />
      </main>
    </div>
  );
}

function getWeekdayLabel(dayIndex: number) {
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels[dayIndex] ?? "—";
}
