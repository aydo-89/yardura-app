import { describe, expect, it, vi, beforeEach } from "vitest";

import { POST } from "@/app/api/schedule/request/route";

const prismaMock = vi.hoisted(() => ({
  serviceVisit: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  customerBillingLedgerEntry: {
    findMany: vi.fn(),
  },
  job: {
    update: vi.fn(),
  },
  customerBillingPlan: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
}));

const createCreditEntryMock = vi.hoisted(() => vi.fn());
const processPendingMock = vi.hoisted(() => vi.fn());
const ensureTrialExtendMock = vi.hoisted(() => vi.fn());
const getPlanByJobIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/billing/ledger", () => ({
  createCreditEntry: createCreditEntryMock,
}));

vi.mock("@/lib/billing/plan", () => ({
  getPlanByJobId: getPlanByJobIdMock,
}));

vi.mock("@/lib/billing/invoice-processor", () => ({
  processPendingLedgerEntriesForJob: processPendingMock,
  ensureTrialExtendsThroughDate: ensureTrialExtendMock,
}));

const createRequest = (body: unknown) =>
  ({
    json: async () => body,
  }) as unknown as Request;

describe("/api/schedule/request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a credit entry when a monthly customer skips a visit", async () => {
    const visit = {
      id: "visit_skip",
      status: "SCHEDULED",
      scheduledDate: new Date("2024-03-01T14:00:00Z"),
      jobId: "job_123",
      customerId: "cust_123",
      orgId: "org_1",
      notes: null,
      actualStart: null,
      job: {
        id: "job_123",
        orgId: "org_1",
        customerId: "cust_123",
        perVisitRevenueCents: 4200,
        billingPlan: {
          id: "plan_123",
          billingPreference: "monthly",
          perVisitAmountCents: 4500,
          trialEndsAt: null,
        },
      },
    };

    prismaMock.serviceVisit.findUnique.mockResolvedValue(visit);
    prismaMock.serviceVisit.findFirst.mockResolvedValue({
      scheduledDate: new Date("2024-03-08T14:00:00Z"),
    });
    prismaMock.serviceVisit.update.mockResolvedValue({ ...visit, status: "SKIPPED" });
    prismaMock.customerBillingLedgerEntry.findMany.mockResolvedValue([]);
    prismaMock.customerBillingPlan.findUnique.mockResolvedValue(null);
    prismaMock.customerBillingPlan.findFirst.mockResolvedValue(null);
    getPlanByJobIdMock.mockResolvedValue({
      id: "plan_123",
      billingPreference: "monthly",
      perVisitAmountCents: 4200,
    });

    const response = await POST(
      createRequest({ visitId: "visit_skip", action: "skip" }) as any,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);

    expect(prismaMock.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job_123" },
        data: { nextVisitAt: new Date("2024-03-08T14:00:00Z") },
      }),
    );

    expect(createCreditEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job_123",
        customerId: "cust_123",
        amountCents: 4200,
        description: "Skipped visit credit",
        metadata: { source: "customer-skip" },
        orgId: "org_1",
        serviceVisitId: "visit_skip",
      }),
    );

    expect(processPendingMock).toHaveBeenCalledWith("job_123");
  });

  it("does not create duplicate credits when a credit already exists", async () => {
    const visit = {
      id: "visit_with_entry",
      status: "SCHEDULED",
      scheduledDate: new Date(),
      jobId: "job_456",
      customerId: "cust_456",
      orgId: "org_2",
      notes: null,
      actualStart: null,
      job: {
        id: "job_456",
        orgId: "org_2",
        customerId: "cust_456",
        perVisitRevenueCents: 3800,
        billingPlan: {
          id: "plan_456",
          billingPreference: "monthly",
          perVisitAmountCents: 4000,
          trialEndsAt: null,
        },
      },
    };

    prismaMock.serviceVisit.findUnique.mockResolvedValue(visit);
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
    prismaMock.serviceVisit.update.mockResolvedValue({ ...visit, status: "SKIPPED" });
    prismaMock.customerBillingLedgerEntry.findMany.mockResolvedValue([
      { amountCents: -4000 },
    ]);
    prismaMock.customerBillingPlan.findUnique.mockResolvedValue(null);
    prismaMock.customerBillingPlan.findFirst.mockResolvedValue(null);
    getPlanByJobIdMock.mockResolvedValue({
      id: "plan_456",
      billingPreference: "monthly",
      perVisitAmountCents: 4000,
    });

    const response = await POST(
      createRequest({ visitId: "visit_with_entry", action: "skip" }) as any,
    );

    expect(response.status).toBe(200);
    expect(prismaMock.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job_456" },
        data: { nextVisitAt: null },
      }),
    );
    expect(createCreditEntryMock).not.toHaveBeenCalled();
    expect(processPendingMock).not.toHaveBeenCalled();
  });

  it("does not create a credit for per-visit plans without a charge entry", async () => {
    const visit = {
      id: "visit_per_visit",
      status: "SCHEDULED",
      scheduledDate: new Date("2024-03-01T14:00:00Z"),
      jobId: "job_789",
      customerId: "cust_789",
      orgId: "org_3",
      notes: null,
      actualStart: null,
      job: {
        id: "job_789",
        orgId: "org_3",
        customerId: "cust_789",
        perVisitRevenueCents: 4200,
        billingPlan: {
          id: "plan_789",
          billingPreference: "per-visit",
          perVisitAmountCents: 4200,
          trialEndsAt: null,
        },
      },
    };

    prismaMock.serviceVisit.findUnique.mockResolvedValue(visit);
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
    prismaMock.serviceVisit.update.mockResolvedValue({ ...visit, status: "SKIPPED" });
    prismaMock.customerBillingLedgerEntry.findMany.mockResolvedValue([]);
    prismaMock.customerBillingPlan.findUnique.mockResolvedValue(null);
    prismaMock.customerBillingPlan.findFirst.mockResolvedValue(null);
    getPlanByJobIdMock.mockResolvedValue({
      id: "plan_789",
      billingPreference: "per-visit",
      perVisitAmountCents: 4200,
    });

    const response = await POST(
      createRequest({ visitId: "visit_per_visit", action: "skip" }) as any,
    );

    expect(response.status).toBe(200);
    expect(createCreditEntryMock).not.toHaveBeenCalled();
    expect(processPendingMock).not.toHaveBeenCalled();
  });

  it("extends the trial when a visit is rescheduled beyond the original window", async () => {
    const originalDate = new Date("2025-05-01T15:00:00Z");
    const futureDate = new Date("2025-05-10T15:00:00Z");

    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: "visit_reschedule",
      scheduledDate: originalDate,
      jobId: "job_reschedule",
      customerId: "cust_reschedule",
      orgId: "org_reschedule",
      status: "SCHEDULED",
      job: {
        id: "job_reschedule",
        orgId: "org_reschedule",
        customerId: "cust_reschedule",
        perVisitRevenueCents: 4000,
        billingPlan: {
          id: "plan_reschedule",
          billingPreference: "weekly",
          perVisitAmountCents: 4000,
          trialEndsAt: new Date("2025-05-05T00:00:00Z"),
        },
      },
    });

    prismaMock.serviceVisit.update.mockResolvedValue({
      id: "visit_reschedule",
      scheduledDate: futureDate,
      status: "SCHEDULED",
    });

    prismaMock.job.update.mockResolvedValue({});
    getPlanByJobIdMock.mockResolvedValue({
      id: "plan_reschedule",
      billingPreference: "weekly",
      perVisitAmountCents: 4200,
      trialEndsAt: null,
      metadata: null,
    });
    prismaMock.customerBillingPlan.findUnique.mockResolvedValue(null);
    prismaMock.customerBillingPlan.findFirst.mockResolvedValue(null);

    const request = createRequest({
      visitId: "visit_reschedule",
      action: "reschedule",
      nextVisitAt: futureDate.toISOString(),
    });

    const response = await POST(request as any);

    expect(response.status).toBe(200);
    expect(ensureTrialExtendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "plan_reschedule",
        visitDate: futureDate,
      }),
    );
  });

  it("extends the trial when rescheduling at the job level", async () => {
    prismaMock.job.update.mockResolvedValue({
      id: "job_base",
      nextVisitAt: new Date("2025-05-02T15:00:00Z"),
    });
    prismaMock.customerBillingPlan.findFirst.mockResolvedValue({
      id: "plan_job_level",
      trialEndsAt: null,
    });
    prismaMock.customerBillingPlan.findUnique.mockResolvedValue({
      id: "plan_job_level",
      billingPreference: "weekly",
      trialEndsAt: null,
      metadata: null,
    });

    const response = await POST(
      createRequest({
        jobId: "job_base",
        action: "reschedule",
        nextVisitAt: new Date("2025-05-10T12:30:00Z").toISOString(),
      }) as any,
    );

    expect(response.status).toBe(200);
    expect(ensureTrialExtendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: "plan_job_level",
      }),
    );
  });
});
