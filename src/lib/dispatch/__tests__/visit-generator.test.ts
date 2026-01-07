import { beforeEach, describe, expect, it, vi } from "vitest";

import { generateServiceVisits } from "@/lib/dispatch/visit-generator";
import { Frequency, JobStatus, ServiceStatus } from "@prisma/client";
import {
  constructZonedDate,
  convertUtcToZonedParts,
  getZonedWeekday,
  SERVICE_TIME_ZONE,
} from "@/lib/timezone";

const prismaMock = vi.hoisted(() => ({
  job: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  serviceVisit: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  serviceTile: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const infoMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/jobs/marketplaceOfferPublisher", () => ({
  enqueueOfferPublishing: vi.fn(),
}));

vi.mock("@/lib/log", () => ({
  info: infoMock,
  warn: warnMock,
  error: vi.fn(),
  debug: vi.fn(),
}));

describe("generateServiceVisits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.serviceVisit.findMany.mockResolvedValue([]);
  });

  it.each([
    {
      label: "one-time",
      frequency: Frequency.ONE_TIME,
      lookAheadDays: 27,
      expectedCount: 1,
      expectedWeekdays: [1],
    },
    {
      label: "weekly",
      frequency: Frequency.WEEKLY,
      lookAheadDays: 27,
      expectedCount: 4,
      expectedWeekdays: [1],
    },
    {
      label: "bi-weekly",
      frequency: Frequency.BI_WEEKLY,
      lookAheadDays: 27,
      expectedCount: 2,
      expectedWeekdays: [1],
    },
    {
      label: "twice-weekly",
      frequency: Frequency.TWICE_WEEKLY,
      lookAheadDays: 27,
      expectedCount: 8,
      expectedWeekdays: [1, 4],
    },
    {
      label: "daily (weekday-only)",
      frequency: Frequency.DAILY,
      lookAheadDays: 27,
      expectedCount: 20,
      expectedWeekdays: [1, 2, 3, 4, 5],
      weekendUpgrade: false,
    },
    {
      label: "daily (weekend included)",
      frequency: Frequency.DAILY,
      lookAheadDays: 27,
      expectedCount: 28,
      expectedWeekdays: [0, 1, 2, 3, 4, 5, 6],
      weekendUpgrade: true,
    },
    {
      label: "monthly",
      frequency: Frequency.MONTHLY,
      lookAheadDays: 27,
      expectedCount: 1,
      expectedWeekdays: [1],
    },
  ])(
    "generates the expected cadence for $label jobs",
    async ({ frequency, lookAheadDays, expectedCount, expectedWeekdays, weekendUpgrade }) => {
      const baseDate = constructZonedDate(2025, 4, 7, 9, 0, 0, 0, SERVICE_TIME_ZONE);

      prismaMock.job.findMany.mockResolvedValue([
        {
          id: `job_${frequency.toLowerCase()}`,
          orgId: "org",
          customerId: "cust",
          tileId: null,
          frequency,
          status: JobStatus.ACTIVE,
          dayOfWeek: null,
          nextVisitAt: baseDate,
          perVisitRevenueCents: 2500,
          customer: {
            id: "cust",
            name: "Cadence Customer",
            notes: null,
          },
          billingPlan: {
            metadata: {
              serviceOptions: {
                weekendUpgrade: Boolean(weekendUpgrade),
              },
            },
          },
          preferredTimeWindow: null,
          preferredTimeWindowSlug: null,
          extraAreas: 0,
        } as any,
      ]);

      prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
      prismaMock.job.update.mockResolvedValue({});
      prismaMock.$transaction.mockImplementation(async (callback: any) =>
        callback({
          serviceVisit: prismaMock.serviceVisit,
          job: prismaMock.job,
        }),
      );

      const results = await generateServiceVisits({
        orgId: "org",
        date: baseDate,
        lookAheadDays,
        dryRun: true,
      });

      expect(results).toHaveLength(expectedCount);
      const weekdays = new Set(
        results.map((entry) => getZonedWeekday(entry.visit.scheduledDate, SERVICE_TIME_ZONE)),
      );
      expectedWeekdays.forEach((weekday) => {
        expect(weekdays.has(weekday)).toBe(true);
      });
    },
  );

  it("reuses pre-seeded trial visits instead of duplicating them", async () => {
    const baseDate = new Date("2025-04-03T09:00:00Z");

    prismaMock.job.findMany.mockResolvedValue([
      {
        id: "job_daily_trial",
        orgId: "org",
        customerId: "cust",
        tileId: null,
        frequency: Frequency.DAILY,
        status: JobStatus.ACTIVE,
        dayOfWeek: null,
        nextVisitAt: baseDate,
        perVisitRevenueCents: 2500,
        customer: {
          id: "cust",
          name: "Trial Customer",
          notes: null,
        },
        billingPlan: {
          metadata: {
            serviceOptions: {
              weekendUpgrade: false,
            },
          },
        },
        preferredTimeWindow: null,
        preferredTimeWindowSlug: null,
        extraAreas: 0,
      } as any,
    ]);

    const existingVisit = {
      id: "visit_existing",
      jobId: "job_daily_trial",
      orgId: "org",
      customerId: "cust",
      scheduledDate: baseDate,
      status: ServiceStatus.SCHEDULED,
    } as any;

    prismaMock.serviceVisit.findFirst.mockImplementation(async (args: any) => {
      if (args?.where?.status) {
        const gte = args?.where?.scheduledDate?.gte as Date | undefined;
        const lt = args?.where?.scheduledDate?.lt as Date | undefined;
        if (gte && lt && baseDate >= gte && baseDate < lt) {
          return existingVisit;
        }
        return null;
      }
      if (args?.where?.scheduledDate?.lt) {
        return {
          id: "visit_prior",
          scheduledDate: new Date("2025-04-02T09:00:00Z"),
          preferredTimeWindowSlug: "morning",
        } as any;
      }
      return null;
    });

    prismaMock.serviceVisit.create.mockImplementation(async (args: any) => ({
      id: "visit_new",
      scheduledDate: args?.data?.scheduledDate,
      tileId: null,
    }));
    prismaMock.job.update.mockResolvedValue({});
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.serviceTile.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback({
        serviceVisit: prismaMock.serviceVisit,
        job: prismaMock.job,
      }),
    );

    const results = await generateServiceVisits({
      orgId: "org",
      date: new Date("2025-04-02T00:00:00Z"),
      lookAheadDays: 3,
    });

    expect(prismaMock.serviceVisit.create).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
    const reused = results.find((entry) => entry.visit.id === "visit_existing");
    expect(reused?.isNew).toBe(false);

    expect(infoMock).toHaveBeenCalled();
    const [, payload] = infoMock.mock.calls.at(-1) ?? [];
    expect(payload).toMatchObject({
      visitsCreated: 1,
      visitsReused: 1,
      jobsWithReusedVisits: 1,
      jobsReusedOnly: 0,
      weekendDailyJobs: 0,
    });

    expect(warnMock).not.toHaveBeenCalled();
  });

  it("assigns generated visits to the job's primary scooper when set", async () => {
    const baseDate = new Date("2025-04-07T09:00:00Z");

    prismaMock.job.findMany.mockResolvedValue([
      {
        id: "job_with_primary",
        orgId: "org",
        customerId: "cust",
        tileId: null,
        frequency: Frequency.WEEKLY,
        status: JobStatus.ACTIVE,
        dayOfWeek: null,
        nextVisitAt: baseDate,
        perVisitRevenueCents: 2500,
        primaryScooperId: "scooper-1",
        customer: {
          id: "cust",
          name: "Assigned Customer",
          notes: null,
        },
        billingPlan: {
          metadata: null,
        },
        preferredTimeWindow: null,
        preferredTimeWindowSlug: null,
        extraAreas: 0,
      } as any,
    ]);

    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
    prismaMock.job.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback({
        serviceVisit: prismaMock.serviceVisit,
        job: prismaMock.job,
      }),
    );

    const results = await generateServiceVisits({
      orgId: "org",
      date: baseDate,
      lookAheadDays: 7,
      dryRun: true,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.visit.assignedToId).toBe("scooper-1");
  });

  it("backfills the next weekly visit when the kickoff visit is the only one scheduled", async () => {
    const kickoff = new Date("2026-01-01T08:00:00Z");

    prismaMock.job.findMany.mockResolvedValue([
      {
        id: "job_weekly_gap",
        orgId: "org",
        customerId: "cust",
        tileId: null,
        frequency: Frequency.WEEKLY,
        status: JobStatus.ACTIVE,
        dayOfWeek: 4,
        nextVisitAt: new Date("2026-01-15T08:00:00Z"),
        perVisitRevenueCents: 2500,
        customer: {
          id: "cust",
          name: "Gap Customer",
          notes: null,
        },
        billingPlan: {
          metadata: null,
        },
        preferredTimeWindow: "Morning (8:00am – 12:00pm)",
        preferredTimeWindowSlug: "morning",
        extraAreas: 0,
      } as any,
    ]);

    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "visit_kickoff",
        scheduledDate: kickoff,
        status: ServiceStatus.SCHEDULED,
        preferredTimeWindowSlug: "morning",
        preferredTimeWindow: "Morning (8:00am – 12:00pm)",
      } as any,
    ]);

    prismaMock.serviceVisit.findFirst.mockImplementation(async (args: any) => {
      const gte = args?.where?.scheduledDate?.gte;
      const lt = args?.where?.scheduledDate?.lt;
      if (gte && lt && kickoff >= gte && kickoff < lt) {
        return {
          id: "visit_kickoff",
          scheduledDate: kickoff,
          preferredTimeWindowSlug: "morning",
          preferredTimeWindow: "Morning (8:00am – 12:00pm)",
        } as any;
      }
      return null;
    });

    prismaMock.job.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback({
        serviceVisit: prismaMock.serviceVisit,
        job: prismaMock.job,
      }),
    );

    const results = await generateServiceVisits({
      orgId: "org",
      date: new Date("2026-01-01T00:00:00Z"),
      lookAheadDays: 21,
      dryRun: true,
    });

    const hasExpectedNext = results.some((entry) => {
      const parts = convertUtcToZonedParts(entry.visit.scheduledDate, SERVICE_TIME_ZONE);
      return parts.year === 2026 && parts.month === 1 && parts.day === 8;
    });

    expect(hasExpectedNext).toBe(true);
  });

  it("leaves visits unassigned when no primary scooper is set", async () => {
    const baseDate = new Date("2025-04-07T09:00:00Z");

    prismaMock.job.findMany.mockResolvedValue([
      {
        id: "job_no_primary",
        orgId: "org",
        customerId: "cust",
        tileId: null,
        frequency: Frequency.WEEKLY,
        status: JobStatus.ACTIVE,
        dayOfWeek: null,
        nextVisitAt: baseDate,
        perVisitRevenueCents: 2500,
        primaryScooperId: null,
        customer: {
          id: "cust",
          name: "Unassigned Customer",
          notes: null,
        },
        billingPlan: {
          metadata: null,
        },
        preferredTimeWindow: null,
        preferredTimeWindowSlug: null,
        extraAreas: 0,
      } as any,
    ]);

    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
    prismaMock.job.update.mockResolvedValue({});
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback({
        serviceVisit: prismaMock.serviceVisit,
        job: prismaMock.job,
      }),
    );

    const results = await generateServiceVisits({
      orgId: "org",
      date: baseDate,
      lookAheadDays: 7,
      dryRun: true,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.visit.assignedToId).toBeNull();
  });

  it("reschedules overdue unassigned visits and skips new generation", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-04-08T12:00:00Z"));

    const overdueDate = new Date("2025-04-06T09:00:00Z");

    prismaMock.job.findMany.mockResolvedValue([
      {
        id: "job_overdue",
        orgId: "org",
        customerId: "cust",
        tileId: null,
        frequency: Frequency.WEEKLY,
        status: JobStatus.ACTIVE,
        dayOfWeek: null,
        nextVisitAt: overdueDate,
        perVisitRevenueCents: 2500,
        customer: {
          id: "cust",
          name: "Overdue Customer",
          notes: null,
        },
        billingPlan: {
          metadata: null,
        },
        preferredTimeWindow: null,
        preferredTimeWindowSlug: "morning",
        extraAreas: 0,
      } as any,
    ]);

    prismaMock.serviceVisit.findFirst.mockImplementation(async (args: any) => {
      if (args?.where?.scheduledDate?.lt && !args?.where?.scheduledDate?.gte) {
        return {
          id: "visit_overdue",
          scheduledDate: overdueDate,
          preferredTimeWindow: "Morning window",
          preferredTimeWindowSlug: "morning",
          metadata: null,
        } as any;
      }
      return null;
    });

    prismaMock.serviceVisit.update.mockResolvedValue({} as any);
    prismaMock.job.update.mockResolvedValue({});
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.serviceTile.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback({
        serviceVisit: prismaMock.serviceVisit,
        job: prismaMock.job,
      }),
    );

    const results = await generateServiceVisits({
      orgId: "org",
      date: new Date("2025-04-08T00:00:00Z"),
      lookAheadDays: 7,
    });

    expect(results).toHaveLength(0);
    expect(prismaMock.serviceVisit.create).not.toHaveBeenCalled();
    expect(prismaMock.serviceVisit.update).toHaveBeenCalledTimes(1);

    const updateCall = prismaMock.serviceVisit.update.mock.calls[0]?.[0];
    const rescheduledDate = updateCall?.data?.scheduledDate as Date | undefined;
    expect(rescheduledDate).toBeInstanceOf(Date);
    if (rescheduledDate instanceof Date) {
      expect(rescheduledDate.getTime()).toBeGreaterThan(overdueDate.getTime());
    }

    vi.useRealTimers();
  });
});
