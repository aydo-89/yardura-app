import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma, ServiceStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
} from "@/lib/time-window";
import { getZonedWeekday, SERVICE_TIME_ZONE } from "@/lib/timezone";

const ALLOWED_STATUSES: ServiceStatus[] = [
  ServiceStatus.SCHEDULED,
  ServiceStatus.IN_PROGRESS,
  ServiceStatus.CANCELLED,
  ServiceStatus.SKIPPED,
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ visitId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { visitId } = await params;
  if (!visitId) {
    return NextResponse.json({ error: "Visit ID required" }, { status: 400 });
  }

  const orgId = (session.user as any)?.orgId ?? null;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { scheduledDate, preferredTimeWindowSlug, status } = body as {
    scheduledDate?: string;
    preferredTimeWindowSlug?: string | null;
    status?: ServiceStatus;
  };

  let nextScheduledDate: Date | undefined;
  if (typeof scheduledDate === "string" && scheduledDate.trim().length) {
    const parsed = new Date(scheduledDate);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Invalid scheduledDate" },
        { status: 400 },
      );
    }
    nextScheduledDate = parsed;
  }

  let nextStatus: ServiceStatus | undefined;
  if (typeof status === "string") {
    const normalized = status.toUpperCase() as ServiceStatus;
    if (!ALLOWED_STATUSES.includes(normalized)) {
      return NextResponse.json(
        { error: "Unsupported status" },
        { status: 400 },
      );
    }
    nextStatus = normalized;
  }

  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId },
    select: {
      id: true,
      orgId: true,
      jobId: true,
      customerId: true,
      job: {
        select: {
          id: true,
          orgId: true,
        },
      },
      customer: {
        select: {
          orgId: true,
        },
      },
    },
  });

  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const visitOrgId =
    visit.orgId ?? visit.job?.orgId ?? visit.customer?.orgId ?? null;

  if (orgId && visitOrgId && visitOrgId !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const slug = normalizePreferredTimeWindowSlug(preferredTimeWindowSlug ?? undefined);
  const preferredLabel = slug
    ? resolvePreferredTimeWindowLabel(slug, null)
    : undefined;

  const metadataUpdates: Record<string, unknown> = {};
  if (slug) {
    metadataUpdates.preferredTimeWindowSlug = slug;
    metadataUpdates.preferredTimeWindow = preferredLabel ?? slug;
  }

  const existingMetadata = await prisma.serviceVisit.findUnique({
    where: { id: visitId },
    select: { metadata: true },
  });

  const sanitizedMetadata = existingMetadata?.metadata &&
    typeof existingMetadata.metadata === "object"
    ? { ...(existingMetadata.metadata as Record<string, unknown>) }
    : {};

  const updated = await prisma.serviceVisit.update({
    where: { id: visitId },
    data: {
      ...(nextScheduledDate ? { scheduledDate: nextScheduledDate } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(slug ? { preferredTimeWindowSlug: slug, preferredTimeWindow: preferredLabel } : {}),
      ...(slug || Object.keys(metadataUpdates).length
        ? {
            metadata: metadataUpdates && Object.keys(metadataUpdates).length
              ? ( {
                  ...sanitizedMetadata,
                  ...metadataUpdates,
                } as Prisma.JsonObject )
              : (sanitizedMetadata as Prisma.JsonObject),
          }
        : {}),
    },
    include: {
      assignedTo: {
        select: { id: true, name: true },
      },
    },
  });

  if (visit.jobId) {
    await refreshJobNextVisit(visit.jobId);
  }

  return NextResponse.json({
    visit: serializeVisit(updated),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ visitId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { visitId } = await params;
  if (!visitId) {
    return NextResponse.json({ error: "Visit ID required" }, { status: 400 });
  }

  const orgId = (session.user as any)?.orgId ?? null;

  const visit = await prisma.serviceVisit.findFirst({
    where: { id: visitId },
    select: {
      id: true,
      status: true,
      jobId: true,
      orgId: true,
      job: { select: { orgId: true } },
      customer: { select: { orgId: true } },
    },
  });

  if (!visit) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  }

  const visitOrgId =
    visit.orgId ?? visit.job?.orgId ?? visit.customer?.orgId ?? null;

  if (orgId && visitOrgId && visitOrgId !== orgId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (
    visit.status === ServiceStatus.COMPLETED ||
    visit.status === ServiceStatus.IN_PROGRESS
  ) {
    return NextResponse.json(
      { error: "Cannot delete a visit that has already started" },
      { status: 400 },
    );
  }

  await prisma.serviceVisit.delete({ where: { id: visitId } });

  if (visit.jobId) {
    await refreshJobNextVisit(visit.jobId);
  }

  return NextResponse.json({ ok: true });
}

async function refreshJobNextVisit(jobId: string) {
  const nextVisit = await prisma.serviceVisit.findFirst({
    where: {
      jobId,
      status: {
        in: [ServiceStatus.SCHEDULED, ServiceStatus.IN_PROGRESS],
      },
    },
    orderBy: { scheduledDate: "asc" },
  });

  await prisma.job.update({
    where: { id: jobId },
    data: {
      nextVisitAt: nextVisit?.scheduledDate ?? null,
      dayOfWeek: nextVisit?.scheduledDate
        ? getZonedWeekday(nextVisit.scheduledDate, SERVICE_TIME_ZONE)
        : null,
    },
  });
}

function serializeVisit(visit: {
  id: string;
  scheduledDate: Date;
  status: ServiceStatus;
  preferredTimeWindowSlug: string | null;
  preferredTimeWindow: string | null;
  assignedTo: { id: string; name: string | null } | null;
}) {
  return {
    id: visit.id,
    scheduledDate: visit.scheduledDate.toISOString(),
    status: visit.status,
    preferredTimeWindowSlug: visit.preferredTimeWindowSlug,
    preferredTimeWindow: visit.preferredTimeWindow,
    assignedTo: visit.assignedTo
      ? { id: visit.assignedTo.id, name: visit.assignedTo.name }
      : null,
  };
}
