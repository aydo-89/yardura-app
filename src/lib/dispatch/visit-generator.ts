import {
  Frequency,
  Job,
  JobStatus,
  Prisma,
  ServiceStatus,
  ServiceType,
  ServiceVisit,
  YardSize,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { info, warn } from "@/lib/log";
import {
  resolveNextScheduledDate,
  resolveSubsequentVisitDate,
  startOfDay,
  addDays,
} from "./frequency";
import {
  getPreferredTimeWindowStart,
  normalizePreferredTimeWindowSlug,
  resolvePreferredTimeWindowLabel,
} from "@/lib/time-window";
import { enqueueOfferPublishing } from "@/lib/jobs/marketplaceOfferPublisher";
import {
  constructZonedDate,
  convertUtcToZonedParts,
  getZonedWeekday,
  SERVICE_TIME_ZONE,
} from "@/lib/timezone";
import {
  applyMarketplaceDelayMetadata,
  resolveDelayedSchedule,
} from "@/lib/marketplace/visit-delay";
import { resolveDisposalMode } from "@/lib/service-visits/disposal";

export interface GenerateVisitsOptions {
  orgId: string;
  /** Optional targeted set of jobs to process. */
  jobIds?: string[];
  /** Inclusive start date (defaults to today). */
  date?: Date;
  /** Number of days ahead (inclusive) to generate visits for. */
  lookAheadDays?: number;
  /** If true, no records are written but the would-be visits are returned. */
  dryRun?: boolean;
  /** Limit number of jobs processed in one batch when jobIds isn't supplied. */
  jobLimit?: number;
}

export interface GeneratedVisitResult {
  visit: ServiceVisit;
  job: JobWithCustomer;
  isNew: boolean;
}

type JobWithCustomer = Job & {
  customer: {
    id: string;
    name: string;
    notes: string | null;
  };
  billingPlan?: {
    metadata: Prisma.JsonValue | null;
  } | null;
};

function isWeekend(date: Date) {
  const day = getZonedWeekday(date, SERVICE_TIME_ZONE);
  return day === 0 || day === 6;
}

function inferServiceType(job: Job): ServiceType {
  switch (job.frequency) {
    case "ONE_TIME":
      return ServiceType.ONE_TIME;
    default:
      return ServiceType.REGULAR;
  }
}

function inferYardSize(job: JobWithCustomer): YardSize {
  // TODO: extend data model with explicit yard-size metadata per customer/job.
  return YardSize.MEDIUM;
}

function inferDogCount(job: JobWithCustomer): number {
  // TODO: extend schema so we can capture dog counts per job/customer.
  if (typeof job.dogCount === "number" && job.dogCount > 0) {
    return job.dogCount;
  }
  return Math.max(1, job.extraAreas ?? 0) || 1;
}

function resolveVisitDeodorize(
  mode: Job["deodorizeMode"] | null | undefined,
  hasPreviousVisit: boolean,
): boolean {
  const normalized = typeof mode === "string" ? mode.toUpperCase() : "NONE";
  if (normalized === "EACH_VISIT") return true;
  if (normalized === "FIRST_VISIT") return !hasPreviousVisit;
  return false;
}

function alignDateToAnchorTime(date: Date, anchor: Date): Date {
  const dateParts = convertUtcToZonedParts(date, SERVICE_TIME_ZONE);
  const anchorParts = convertUtcToZonedParts(anchor, SERVICE_TIME_ZONE);
  return constructZonedDate(
    dateParts.year,
    dateParts.month,
    dateParts.day,
    anchorParts.hour,
    anchorParts.minute,
    anchorParts.second,
    0,
    SERVICE_TIME_ZONE,
  );
}

function computeTargetWindow(date: Date, lookAheadDays: number) {
  const start = startOfDay(date);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + lookAheadDays);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function findExistingVisit(jobId: string, scheduledDate: Date) {
  const start = startOfDay(scheduledDate);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return prisma.serviceVisit.findFirst({
    where: {
      jobId,
      scheduledDate: {
        gte: start,
        lt: end,
      },
      status: {
        in: [
          ServiceStatus.SCHEDULED,
          ServiceStatus.IN_PROGRESS,
          ServiceStatus.COMPLETED,
        ],
      },
    },
  });
}

async function createServiceVisitForJob(
  job: JobWithCustomer,
  scheduledDate: Date,
  tx: Prisma.TransactionClient,
): Promise<ServiceVisit> {
  const previousVisit = await tx.serviceVisit.findFirst({
    where: {
      jobId: job.id,
      scheduledDate: {
        lt: scheduledDate,
      },
    },
    orderBy: { scheduledDate: "desc" },
  });

  const previousMetadata =
    previousVisit?.metadata &&
    typeof previousVisit.metadata === "object" &&
    !Array.isArray(previousVisit.metadata)
      ? (previousVisit.metadata as Record<string, unknown>)
      : null;
  const previousDelayMeta =
    previousMetadata && typeof previousMetadata.marketplaceDelay === "object"
      ? (previousMetadata.marketplaceDelay as Record<string, unknown>)
      : null;
  const previousWindowOverride =
    Boolean(previousDelayMeta?.windowOverride) ||
    Boolean(previousMetadata?.windowOverride);

  const normalizedSlug =
    (!previousWindowOverride
      ? normalizePreferredTimeWindowSlug(previousVisit?.preferredTimeWindowSlug)
      : null) ??
    normalizePreferredTimeWindowSlug(job.preferredTimeWindowSlug) ??
    "morning";

  const preferredLabel =
    resolvePreferredTimeWindowLabel(
      normalizedSlug,
      (!previousWindowOverride ? previousVisit?.preferredTimeWindow : null) ??
        job.preferredTimeWindow ??
        null,
    ) ??
    resolvePreferredTimeWindowLabel(normalizedSlug);

  const scheduledDateTime = new Date(scheduledDate);
  scheduledDateTime.setSeconds(0, 0);

  if (previousVisit && !previousWindowOverride) {
    const previousScheduled = new Date(previousVisit.scheduledDate);
    scheduledDateTime.setHours(
      previousScheduled.getHours(),
      previousScheduled.getMinutes(),
      0,
      0,
    );
  } else if (job.nextVisitAt) {
    const nextVisit = new Date(job.nextVisitAt);
    scheduledDateTime.setHours(nextVisit.getHours(), nextVisit.getMinutes(), 0, 0);
  } else {
    const startConfig = getPreferredTimeWindowStart(normalizedSlug);
    if (startConfig) {
      scheduledDateTime.setHours(startConfig.hour, startConfig.minute, 0, 0);
    } else {
      scheduledDateTime.setHours(9, 0, 0, 0);
    }
  }

  if (
    normalizedSlug &&
    (job.preferredTimeWindowSlug !== normalizedSlug || job.preferredTimeWindow !== preferredLabel)
  ) {
    await tx.job.update({
      where: { id: job.id },
      data: {
        preferredTimeWindowSlug: normalizedSlug,
        preferredTimeWindow: preferredLabel ?? undefined,
      },
    });
  }

  const planMetadata =
    job.billingPlan?.metadata &&
    typeof job.billingPlan.metadata === "object" &&
    !Array.isArray(job.billingPlan.metadata)
      ? (job.billingPlan.metadata as Record<string, any>)
      : null;

  const extractRecord = (value: unknown): Prisma.JsonObject | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Prisma.JsonObject)
      : null;

  const accessPreferences = extractRecord(planMetadata?.accessPreferences);
  const dogPreferences = extractRecord(planMetadata?.dogPreferences);
  const disposalPreferences = extractRecord(planMetadata?.disposalPreferences);

  const requiresGatePhotoRaw = planMetadata?.requiresGatePhoto;
  const requiresBagDropPhotoRaw = planMetadata?.requiresBagDropPhoto;
  const disposalMode = resolveDisposalMode(
    typeof disposalPreferences?.mode === "string" ? disposalPreferences.mode : null,
  );

  const resolvedRequiresGatePhoto =
    typeof requiresGatePhotoRaw === "boolean"
      ? requiresGatePhotoRaw
      : typeof accessPreferences?.requiresGatePhoto === "boolean"
        ? accessPreferences.requiresGatePhoto
        : true;

  const resolvedRequiresBagDropPhoto =
    disposalMode !== "standard"
      ? true
      : typeof requiresBagDropPhotoRaw === "boolean"
        ? requiresBagDropPhotoRaw
        : typeof disposalPreferences?.requiresBinConfirmation === "boolean"
          ? disposalPreferences.requiresBinConfirmation
          : false;

  const visitMetadata: Prisma.JsonObject = {};
  if (normalizedSlug) {
    visitMetadata.preferredTimeWindowSlug = normalizedSlug;
  }
  if (accessPreferences) {
    visitMetadata.accessPreferences = accessPreferences;
  }
  if (dogPreferences) {
    visitMetadata.dogPreferences = dogPreferences;
  }
  if (disposalPreferences) {
    visitMetadata.disposalPreferences = disposalPreferences;
  }
  visitMetadata.requiresGatePhoto = resolvedRequiresGatePhoto;
  visitMetadata.requiresBagDropPhoto = resolvedRequiresBagDropPhoto;
  if (typeof job.extraAreas === "number" && job.extraAreas > 0) {
    visitMetadata.extraAreasCount = job.extraAreas;
  }

  const requiresDeodorize = resolveVisitDeodorize(
    job.deodorizeMode,
    Boolean(previousVisit),
  );

  const visit = await tx.serviceVisit.create({
    data: {
      orgId: job.orgId,
      customerId: job.customerId,
      jobId: job.id,
      scheduledDate: scheduledDateTime,
      status: ServiceStatus.SCHEDULED,
      serviceType: inferServiceType(job),
      yardSize: inferYardSize(job),
      dogsServiced: inferDogCount(job),
      assignedToId: job.primaryScooperId ?? null,
      autoGenerated: true,
      notes: job.customer.notes ?? undefined,
      metadata: visitMetadata,
      preferredTimeWindow: preferredLabel ?? undefined,
      preferredTimeWindowSlug: normalizedSlug ?? undefined,
      tileId: job.tileId ?? null,
      revenueCents: job.perVisitRevenueCents ?? null,
      deodorize: requiresDeodorize,
    },
  });

  if (job.frequency !== Frequency.MONTHLY && job.dayOfWeek == null) {
    await tx.job.update({
      where: { id: job.id },
      data: {
        dayOfWeek: getZonedWeekday(scheduledDate, SERVICE_TIME_ZONE),
      },
    });
  }

  return visit;
}

async function updateJobNextVisit(
  job: JobWithCustomer,
  lastScheduledDate: Date,
  tx: Prisma.TransactionClient,
  options?: { weekendUpgrade?: boolean },
): Promise<Date | null> {
  if (job.frequency === Frequency.ONE_TIME) {
    await tx.job.update({
      where: { id: job.id },
      data: { nextVisitAt: null, status: JobStatus.CANCELED },
    });
    return null;
  }

  const nextDate = resolveSubsequentVisitDate(
    lastScheduledDate,
    job.frequency,
    job.dayOfWeek,
  );

  const nextWithTime = new Date(nextDate);
  nextWithTime.setHours(
    lastScheduledDate.getHours(),
    lastScheduledDate.getMinutes(),
    0,
    0,
  );

  if (job.frequency === Frequency.DAILY && !options?.weekendUpgrade) {
    while (isWeekend(nextWithTime)) {
      nextWithTime.setDate(nextWithTime.getDate() + 1);
    }
  }

  const updateData: Prisma.JobUpdateInput = {
    nextVisitAt: nextWithTime,
  };

  if (job.frequency !== Frequency.MONTHLY && job.dayOfWeek == null) {
    const resolvedDay = getZonedWeekday(lastScheduledDate, SERVICE_TIME_ZONE);
    updateData.dayOfWeek = resolvedDay;
    job.dayOfWeek = resolvedDay;
  }

  await tx.job.update({
    where: { id: job.id },
    data: updateData,
  });

  return nextWithTime;
}

export async function generateServiceVisits(
  options: GenerateVisitsOptions,
): Promise<GeneratedVisitResult[]> {
  const {
    orgId,
    jobIds,
    date = new Date(),
    lookAheadDays = 0,
    dryRun = false,
    jobLimit = 250,
  } = options;
  const now = new Date();
  const overdueCutoff = startOfDay(now);

  const { start, end } = computeTargetWindow(date, lookAheadDays);

  const jobWhere: Prisma.JobWhereInput = {
    orgId,
    status: JobStatus.ACTIVE,
    OR: [
      { nextVisitAt: null },
      { nextVisitAt: { lte: end } },
    ],
  };

  if (jobIds && jobIds.length) {
    jobWhere.id = { in: jobIds };
  }

  const jobs = await prisma.job.findMany({
    where: jobWhere,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          notes: true,
        },
      },
      billingPlan: {
        select: {
          metadata: true,
        },
      },
    },
    take: jobIds && jobIds.length ? jobIds.length : jobLimit,
    orderBy: { nextVisitAt: "asc" },
  });

  if (!jobs.length) {
    return [];
  }

  const results: GeneratedVisitResult[] = [];
  const newlyCreatedTileIds = new Set<string>();
  const jobsWithCreatedVisits = new Set<string>();
  const jobsWithReusedVisits = new Set<string>();
  let overdueRescheduled = 0;
  const cadenceStatuses = [
    ServiceStatus.SCHEDULED,
    ServiceStatus.IN_PROGRESS,
    ServiceStatus.COMPLETED,
    ServiceStatus.CANCELLED,
    ServiceStatus.SKIPPED,
  ];

  await prisma.$transaction(async (tx) => {
    for (const job of jobs) {
      const overdueVisit = await tx.serviceVisit.findFirst({
        where: {
          jobId: job.id,
          status: ServiceStatus.SCHEDULED,
          assignedToId: null,
          backupAssignedToId: null,
          scheduledDate: { lt: overdueCutoff },
        },
        orderBy: { scheduledDate: "asc" },
      });

      if (overdueVisit) {
        if (!dryRun) {
          const previousWindowLabel =
            overdueVisit.preferredTimeWindow ??
            resolvePreferredTimeWindowLabel(
              overdueVisit.preferredTimeWindowSlug,
              null,
            );
          const delaySchedule = resolveDelayedSchedule({
            scheduledDate: overdueVisit.scheduledDate,
            preferredWindowSlug: overdueVisit.preferredTimeWindowSlug,
            now,
          });
          const delayMetadata = applyMarketplaceDelayMetadata({
            raw: overdueVisit.metadata,
            now,
            reason: "overdue_unassigned",
            previousScheduledAt: overdueVisit.scheduledDate,
            previousWindowSlug: overdueVisit.preferredTimeWindowSlug ?? null,
            previousWindowLabel,
          });

          await tx.serviceVisit.update({
            where: { id: overdueVisit.id },
            data: {
              scheduledDate: delaySchedule.scheduledDate,
              preferredTimeWindow:
                delaySchedule.windowLabel ?? previousWindowLabel ?? undefined,
              preferredTimeWindowSlug:
                delaySchedule.windowSlug ??
                overdueVisit.preferredTimeWindowSlug ??
                undefined,
              metadata: delayMetadata,
            },
          });

          await tx.job.update({
            where: { id: job.id },
            data: { nextVisitAt: delaySchedule.scheduledDate },
          });

          job.nextVisitAt = delaySchedule.scheduledDate;
        }

        overdueRescheduled += 1;
        continue;
      }

      const planMetadata =
        job.billingPlan?.metadata &&
        typeof job.billingPlan.metadata === "object" &&
        !Array.isArray(job.billingPlan.metadata)
          ? (job.billingPlan.metadata as Record<string, any>)
          : null;
      const weekendUpgrade =
        job.frequency === Frequency.DAILY &&
        Boolean(planMetadata?.serviceOptions?.weekendUpgrade);
      const iterationBudget =
        job.frequency === Frequency.DAILY
          ? Math.min(lookAheadDays + 1, 90)
          : Math.min(Math.max(Math.ceil(lookAheadDays / 3), 1), 26);
      let iterations = 0;

      if (job.frequency === Frequency.WEEKLY) {
        const upcomingVisits = await tx.serviceVisit.findMany({
          where: {
            jobId: job.id,
            scheduledDate: {
              gte: start,
              lt: end,
            },
            status: { in: cadenceStatuses },
          },
          orderBy: { scheduledDate: "asc" },
          take: 2,
        });

        const anchorVisit = upcomingVisits[0];
        const nextVisit = upcomingVisits[1];
        if (anchorVisit) {
          const anchorDay =
            typeof job.dayOfWeek === "number"
              ? job.dayOfWeek
              : getZonedWeekday(anchorVisit.scheduledDate, SERVICE_TIME_ZONE);
          const expectedNext = resolveSubsequentVisitDate(
            new Date(anchorVisit.scheduledDate),
            job.frequency,
            anchorDay,
          );

          if (expectedNext <= end) {
            const expectedNextWithTime = alignDateToAnchorTime(
              expectedNext,
              anchorVisit.scheduledDate,
            );
            const expectedStart = startOfDay(expectedNextWithTime);
            const expectedEnd = addDays(expectedStart, 1);
            const hasExpected = await tx.serviceVisit.findFirst({
              where: {
                jobId: job.id,
                scheduledDate: {
                  gte: expectedStart,
                  lt: expectedEnd,
                },
                status: { in: cadenceStatuses },
              },
            });

            if (
              !hasExpected &&
              (!nextVisit ||
                startOfDay(new Date(nextVisit.scheduledDate)).getTime() >
                  expectedStart.getTime())
            ) {
              if (!dryRun) {
                await tx.job.update({
                  where: { id: job.id },
                  data: {
                    nextVisitAt: expectedNextWithTime,
                    ...(job.dayOfWeek == null ? { dayOfWeek: anchorDay } : {}),
                  },
                });
              }
              job.nextVisitAt = expectedNextWithTime;
              if (job.dayOfWeek == null) {
                job.dayOfWeek = anchorDay;
              }
            }
          }
        }
      }

      while (iterations < iterationBudget) {
        let targetDate = resolveNextScheduledDate({
          frequency: job.frequency,
          dayOfWeek: job.dayOfWeek,
          currentNextVisitAt: job.nextVisitAt ?? null,
          referenceDate: start,
        });

        if (job.frequency === Frequency.DAILY && !weekendUpgrade) {
          while (isWeekend(targetDate)) {
            targetDate = addDays(targetDate, 1);
          }
        }

        if (targetDate > end) {
          break;
        }

        const existing = await findExistingVisit(job.id, targetDate);

        if (existing) {
          results.push({ visit: existing, job, isNew: false });
          jobsWithReusedVisits.add(job.id);

          if (job.dayOfWeek == null && existing.scheduledDate) {
            job.dayOfWeek = getZonedWeekday(existing.scheduledDate, SERVICE_TIME_ZONE);
          }

          const next = await updateJobNextVisit(
            job,
            new Date(existing.scheduledDate),
            tx,
            { weekendUpgrade },
          );
          job.nextVisitAt = next;

          if (!next) {
            break;
          }

          iterations += 1;
          continue;
        }

        if (dryRun) {
          const previousVisit = await tx.serviceVisit.findFirst({
            where: {
              jobId: job.id,
              scheduledDate: {
                lt: targetDate,
              },
            },
            orderBy: { scheduledDate: "desc" },
          });
          const requiresDeodorize = resolveVisitDeodorize(
            job.deodorizeMode,
            Boolean(previousVisit),
          );
          const now = new Date();
          const projected: ServiceVisit = {
            id: `dryrun-${job.id}-${targetDate.getTime()}`,
            orgId: job.orgId,
            customerId: job.customerId,
            jobId: job.id,
            userId: null,
            assignedToId: job.primaryScooperId ?? null,
            backupAssignedToId: null,
            skipReasonId: null,
            scheduledDate: targetDate,
            scheduledEnd: null,
            completedDate: null,
            status: ServiceStatus.SCHEDULED,
            serviceType: inferServiceType(job),
            yardSize: inferYardSize(job),
            dogsServiced: inferDogCount(job),
            accountNumber: null,
            notes: job.customer.notes ?? null,
            preferredTimeWindow: job.preferredTimeWindow ?? null,
            preferredTimeWindowSlug: job.preferredTimeWindowSlug ?? null,
            deodorize: requiresDeodorize,
            litterService: false,
            actualStart: null,
            actualEnd: null,
            autoGenerated: true,
            tileId: job.tileId ?? null,
            routeShiftId: null,
            requiredCertifications: null,
            revenueCents: job.perVisitRevenueCents ?? null,
            metadata: {},
            createdAt: now,
            updatedAt: now,
          };

          results.push({ visit: projected, job, isNew: true });
          if (job.dayOfWeek == null) {
            job.dayOfWeek = getZonedWeekday(targetDate, SERVICE_TIME_ZONE);
          }

          let nextDate = resolveSubsequentVisitDate(
            targetDate,
            job.frequency,
            job.dayOfWeek,
          );

          if (job.frequency === Frequency.DAILY && !weekendUpgrade) {
            while (isWeekend(nextDate)) {
              nextDate = addDays(nextDate, 1);
            }
          }

          if (!nextDate) {
            break;
          }

          const nextWithTime = new Date(nextDate);
          nextWithTime.setHours(9, 0, 0, 0);
          job.nextVisitAt = nextWithTime;

          iterations += 1;
          if (job.frequency === Frequency.ONE_TIME) {
            break;
          }
          continue;
        }

        const visit = await createServiceVisitForJob(job, targetDate, tx);
        results.push({ visit, job, isNew: true });
        jobsWithCreatedVisits.add(job.id);
        if (visit.tileId) {
          newlyCreatedTileIds.add(visit.tileId);
        }

        if (job.dayOfWeek == null && visit.scheduledDate) {
          job.dayOfWeek = getZonedWeekday(visit.scheduledDate, SERVICE_TIME_ZONE);
        }

        const next = await updateJobNextVisit(job, new Date(visit.scheduledDate), tx, {
          weekendUpgrade,
        });
        job.nextVisitAt = next;

        if (!next) {
          break;
        }

        iterations += 1;
        if (job.frequency === Frequency.ONE_TIME) {
          break;
        }
      }
    }
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 15000, // 15 seconds - increased from default 5s to handle larger batches
  });

  const createdVisits = results.filter((entry) => entry.isNew);
  const reusedVisits = results.length - createdVisits.length;

  let weekendDailyJobsCount = 0;

  if (!dryRun && createdVisits.length) {
    weekendDailyJobsCount = jobs.filter((job) => {
      if (job.frequency !== Frequency.DAILY) return false;
      const metadata =
        job.billingPlan?.metadata &&
        typeof job.billingPlan.metadata === "object" &&
        !Array.isArray(job.billingPlan.metadata)
          ? (job.billingPlan.metadata as Record<string, unknown>)
          : null;
      return Boolean(metadata?.serviceOptions && (metadata.serviceOptions as any)?.weekendUpgrade);
    }).length;
  }

  if (!dryRun && newlyCreatedTileIds.size) {
    const tilesForOffers = await prisma.serviceTile.findMany({
      where: { id: { in: Array.from(newlyCreatedTileIds) } },
      select: { slug: true },
    });

    await Promise.all(
      tilesForOffers.map((tile) =>
        enqueueOfferPublishing({
          orgId,
          tileSlugs: [tile.slug],
          lookaheadDays: lookAheadDays,
        }),
      ),
    );
  }

  const jobsReusedOnly = Array.from(jobsWithReusedVisits).filter(
    (jobId) => !jobsWithCreatedVisits.has(jobId),
  ).length;

  info("dispatch.visitGenerator", {
    orgId,
    targetedJobIds: jobIds?.length ?? 0,
    totalJobsConsidered: jobs.length,
    visitsCreated: createdVisits.length,
    visitsReused: reusedVisits,
    jobsWithNewVisits: jobsWithCreatedVisits.size,
    jobsWithReusedVisits: jobsWithReusedVisits.size,
    jobsReusedOnly,
    overdueRescheduled,
    weekendDailyJobs: weekendDailyJobsCount,
    lookAheadDays,
    dryRun,
  });

  return results;
}
