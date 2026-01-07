import { beforeEach, describe, expect, it, vi } from "vitest";

import { processPendingLedgerEntriesForJob } from "@/lib/billing/invoice-processor";
import * as ledgerModule from "@/lib/billing/ledger";

const { voidLedgerEntries } = ledgerModule;

const prismaMock = vi.hoisted(() => ({
  customerBillingPlan: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  customerBillingLedgerEntry: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  visitPayout: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const stripeMock = vi.hoisted(() => ({
  invoices: {
    create: vi.fn(),
    finalizeInvoice: vi.fn(),
    del: vi.fn(),
    voidInvoice: vi.fn(),
  },
  invoiceItems: {
    create: vi.fn(),
  },
  subscriptionSchedules: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/stripe", () => ({
  stripe: stripeMock,
}));

vi.mock("@/lib/jobs/billingInvoiceQueue", () => ({
  enqueueBillingInvoiceJob: vi.fn(),
}));

const stripeInvoiceCreate = stripeMock.invoices.create;
const stripeInvoiceFinalize = stripeMock.invoices.finalizeInvoice;
const stripeInvoiceDelete = stripeMock.invoices.del;
const stripeInvoiceVoid = stripeMock.invoices.voidInvoice;
const stripeInvoiceItemCreate = stripeMock.invoiceItems.create;

describe("processPendingLedgerEntriesForJob", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prismaMock.customerBillingLedgerEntry.findFirst.mockResolvedValue(null);
  });

  it("defers invoicing while the trial is active", async () => {
    const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    prismaMock.customerBillingPlan.findUnique.mockImplementation(async () => ({
      id: "plan_job_1",
      jobId: "job_1",
      billingPreference: "monthly",
      stripeCustomerId: "cus_test",
      trialEndsAt: trialEnd,
    }));

    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: trialEnd });

    const result = await processPendingLedgerEntriesForJob("job_1");

    expect(result.status).toBe("deferred");
    expect(prismaMock.customerBillingPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: expect.anything() }),
      }),
    );
    expect(prismaMock.customerBillingLedgerEntry.findMany).not.toHaveBeenCalled();
    expect(stripeInvoiceCreate).not.toHaveBeenCalled();
  });

  it("creates and finalizes an invoice for pending ledger entries", async () => {
    const plan = {
      id: "plan_job_2",
      jobId: "job_2",
      billingPreference: "per-visit" as const,
      stripeCustomerId: "cus_active",
      trialEndsAt: null,
      metadata: null,
    };

    prismaMock.customerBillingPlan.findUnique.mockImplementation(async () => plan);
    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        customerBillingLedgerEntry: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "entry_1",
              jobId: "job_2",
              amountCents: 4500,
              type: "CHARGE",
              description: "Service visit",
              serviceVisitId: "visit_1",
              createdAt: new Date("2024-02-05T00:00:00Z"),
            },
          ]),
          updateMany: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });

    const ledgerUpdateMany = vi
      .spyOn(prismaMock.customerBillingLedgerEntry, "updateMany")
      .mockResolvedValue({ count: 1 });
    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: null });

    stripeInvoiceCreate.mockResolvedValue({ id: "in_test", currency: "usd", status: "draft" });
    stripeInvoiceItemCreate.mockResolvedValue({ id: "ii_test" });
    stripeInvoiceFinalize.mockResolvedValue({ id: "in_test", status: "open" });

    const result = await processPendingLedgerEntriesForJob("job_2");

    expect(result.status).toBe("invoiced");
    expect(stripeInvoiceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_active",
        metadata: expect.objectContaining({ billingPlanId: plan.id }),
      }),
    );
    expect(stripeInvoiceItemCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_active",
        invoice: "in_test",
        amount: 4500,
      }),
    );
    expect(ledgerUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stripeInvoiceId: "in_test",
          stripeInvoiceItemId: "ii_test",
        }),
      }),
    );
    expect(stripeInvoiceFinalize).toHaveBeenCalledWith("in_test", { auto_advance: true });
  });

  it("aggregates monthly charges and credits into grouped invoice items", async () => {
    const plan = {
      id: "plan_job_3",
      jobId: "job_3",
      billingPreference: "monthly" as const,
      stripeCustomerId: "cus_monthly",
      trialEndsAt: null,
      metadata: null,
    };

    prismaMock.customerBillingPlan.findUnique.mockResolvedValue(plan);

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        customerBillingLedgerEntry: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "entry_charge",
              jobId: "job_3",
              amountCents: 20000,
              type: "CHARGE",
              description: "Monthly plan base charge",
              serviceVisitId: null,
            },
            {
              id: "entry_credit",
              jobId: "job_3",
              amountCents: -5000,
              type: "CREDIT",
              description: "Skipped visit credit",
              serviceVisitId: "visit_skip",
            },
          ]),
          updateMany: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });

    const updateManySpy = vi
      .spyOn(prismaMock.customerBillingLedgerEntry, "updateMany")
      .mockResolvedValue({ count: 2 });

    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: null });

    stripeInvoiceCreate.mockResolvedValue({
      id: "in_monthly",
      currency: "usd",
      status: "draft",
    });

    stripeInvoiceItemCreate
      .mockResolvedValueOnce({ id: "ii_charge" })
      .mockResolvedValueOnce({ id: "ii_credit" });

    stripeInvoiceFinalize.mockResolvedValue({ id: "in_monthly", status: "open" });

    const result = await processPendingLedgerEntriesForJob("job_3");

    expect(result.status).toBe("invoiced");
    if (result.status !== "invoiced") {
      throw new Error("Expected invoiced status");
    }
    expect(result.totalAmountCents).toBe(15000);
    expect(stripeInvoiceItemCreate).toHaveBeenCalledTimes(2);
    expect(stripeInvoiceItemCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        customer: "cus_monthly",
        invoice: "in_monthly",
        amount: 20000,
        description: "Monthly plan base charge",
        metadata: expect.objectContaining({
          sourceType: "CHARGE",
          ledgerEntryIds: "entry_charge",
        }),
      }),
    );
    expect(stripeInvoiceItemCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        customer: "cus_monthly",
        invoice: "in_monthly",
        amount: -5000,
        description: "Skipped visit credit",
        metadata: expect.objectContaining({
          sourceType: "CREDIT",
          ledgerEntryIds: "entry_credit",
        }),
      }),
    );

    expect(updateManySpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["entry_charge"] } }),
        data: expect.objectContaining({
          stripeInvoiceId: "in_monthly",
          stripeInvoiceItemId: "ii_charge",
        }),
      }),
    );

    expect(updateManySpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["entry_credit"] } }),
        data: expect.objectContaining({
          stripeInvoiceId: "in_monthly",
          stripeInvoiceItemId: "ii_credit",
        }),
      }),
    );

    expect(updateManySpy).toHaveBeenCalledTimes(2);
  });

  it("posts the monthly base charge when the cadence window has elapsed", async () => {
    const now = new Date("2024-04-15T12:00:00Z");
    const priorCycle = new Date("2024-02-01T00:00:00Z").toISOString();

    const plan = {
      id: "plan_monthly",
      jobId: "job_monthly",
      billingPreference: "monthly" as const,
      stripeCustomerId: "cus_monthly",
      recurringAmountCents: 28000,
      trialEndsAt: null,
      metadata: {
        billingAutomation: {
          billingCadenceDays: 30,
          lastBaseEntryAt: priorCycle,
        },
      },
    };

    const createChargeEntrySpy = vi
      .spyOn(ledgerModule, "createChargeEntry")
      .mockResolvedValue(null as any);

    prismaMock.customerBillingPlan.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id) {
        return { metadata: plan.metadata };
      }
      return plan;
    });

    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: null });

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        customerBillingLedgerEntry: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });

    const result = await processPendingLedgerEntriesForJob(plan.jobId, {
      now,
    });

    expect(result.status).toBe("nothing-to-invoice");
    expect(createChargeEntrySpy).toHaveBeenCalledTimes(1);
    expect(createChargeEntrySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 28000,
        description: "Monthly plan base charge",
        metadata: expect.objectContaining({ source: "monthly-base" }),
      }),
    );
  });

  it("skips monthly base charge when still inside the cadence window", async () => {
    const now = new Date("2024-04-10T12:00:00Z");
    const recent = new Date("2024-03-25T00:00:00Z").toISOString();

    const plan = {
      id: "plan_monthly_recent",
      jobId: "job_monthly_recent",
      billingPreference: "monthly" as const,
      stripeCustomerId: "cus_monthly_recent",
      recurringAmountCents: 32000,
      trialEndsAt: null,
      metadata: {
        billingAutomation: {
          billingCadenceDays: 30,
          lastBaseEntryAt: recent,
        },
      },
    };

    const createChargeEntrySpy = vi
      .spyOn(ledgerModule, "createChargeEntry")
      .mockResolvedValue(null as any);

    prismaMock.customerBillingPlan.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id) {
        return { metadata: plan.metadata };
      }
      return plan;
    });

    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: null });

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        customerBillingLedgerEntry: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });

    const result = await processPendingLedgerEntriesForJob(plan.jobId, {
      now,
    });

    expect(result.status).toBe("nothing-to-invoice");
    expect(createChargeEntrySpy).not.toHaveBeenCalled();
  });

  it("backfills last base timestamp from existing ledger entries", async () => {
    const now = new Date("2024-04-20T12:00:00Z");
    const recentChargeDate = new Date("2024-04-10T08:00:00Z");

    const plan = {
      id: "plan_backfill",
      jobId: "job_backfill",
      billingPreference: "monthly" as const,
      stripeCustomerId: "cus_backfill",
      recurringAmountCents: 19000,
      trialEndsAt: null,
      metadata: {
        billingAutomation: {
          billingCadenceDays: 30,
          lastBaseEntryAt: null,
        },
      },
    };

    const createChargeEntrySpy = vi
      .spyOn(ledgerModule, "createChargeEntry")
      .mockResolvedValue(null as any);

    prismaMock.customerBillingPlan.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id) {
        return { metadata: plan.metadata };
      }
      return plan;
    });

    prismaMock.customerBillingLedgerEntry.findFirst.mockResolvedValue({
      id: "ledger_recent",
      createdAt: recentChargeDate,
      description: "Monthly plan base charge",
    });

    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: null });

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        customerBillingLedgerEntry: {
          findMany: vi.fn().mockResolvedValue([]),
          updateMany: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });

    const result = await processPendingLedgerEntriesForJob(plan.jobId, {
      now,
    });

    expect(result.status).toBe("nothing-to-invoice");
    expect(createChargeEntrySpy).not.toHaveBeenCalled();

    const updateCalls = prismaMock.customerBillingPlan.update.mock.calls;
    expect(updateCalls.length).toBeGreaterThan(0);
    const metadataUpdateCall = updateCalls.find((call) => call[0]?.data?.metadata);
    expect(metadataUpdateCall?.[0].data.metadata.billingAutomation.lastBaseEntryAt).toBe(
      recentChargeDate.toISOString(),
    );
  });

  it("defers invoicing inside an active weekly billing cycle", async () => {
    const now = new Date("2024-03-06T12:00:00Z");
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    prismaMock.customerBillingPlan.findUnique.mockResolvedValue({
      id: "plan_weekly",
      jobId: "job_weekly",
      billingPreference: "weekly" as const,
      stripeCustomerId: "cus_weekly",
      trialEndsAt: null,
      metadata: {
        billingAutomation: {
          lastInvoiceAt: twoDaysAgo.toISOString(),
          billingCadenceDays: 7,
        },
      },
    });

    const result = await processPendingLedgerEntriesForJob("job_weekly", {
      now,
    });

    expect(result.status).toBe("deferred");
    if (result.status === "deferred") {
      expect(result.reason).toBe("cycle-wait");
      expect(result.retryAt.getTime()).toBe(
        new Date(twoDaysAgo.getTime() + 7 * 24 * 60 * 60 * 1000).getTime(),
      );
    }

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(stripeInvoiceCreate).not.toHaveBeenCalled();
  });

  it("defers invoicing inside an active per-visit billing cycle", async () => {
    const now = new Date("2024-03-06T12:00:00Z");
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

    prismaMock.customerBillingPlan.findUnique.mockResolvedValue({
      id: "plan_per_visit",
      jobId: "job_per_visit",
      billingPreference: "per-visit" as const,
      stripeCustomerId: "cus_per_visit",
      trialEndsAt: null,
      metadata: {
        billingAutomation: {
          lastInvoiceAt: fiveDaysAgo.toISOString(),
          billingCadenceDays: 14,
        },
      },
    });

    const result = await processPendingLedgerEntriesForJob("job_per_visit", {
      now,
    });

    expect(result.status).toBe("deferred");
    if (result.status === "deferred") {
      expect(result.reason).toBe("cycle-wait");
      expect(result.retryAt.getTime()).toBe(
        new Date(fiveDaysAgo.getTime() + 14 * 24 * 60 * 60 * 1000).getTime(),
      );
    }

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(stripeInvoiceCreate).not.toHaveBeenCalled();
  });

  it("groups weekly visit charges into a single cycle line item with credits aggregated", async () => {
    const plan = {
      id: "plan_job_week",
      jobId: "job_week",
      billingPreference: "weekly" as const,
      stripeCustomerId: "cus_week",
      trialEndsAt: null,
      metadata: {
        billingAutomation: {
          billingCadenceDays: 7,
          trialStartsAt: "2024-02-05T00:00:00.000Z",
        },
      },
    };

    prismaMock.customerBillingPlan.findUnique.mockResolvedValue(plan);

    const firstVisit = new Date("2024-02-05T15:00:00Z");
    const secondVisit = new Date("2024-02-07T16:30:00Z");

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        customerBillingLedgerEntry: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "entry_visit_1",
              jobId: "job_week",
              amountCents: 3500,
              type: "CHARGE",
              description: null,
              serviceVisitId: "visit_1",
              createdAt: firstVisit,
            },
            {
              id: "entry_visit_2",
              jobId: "job_week",
              amountCents: 3500,
              type: "CHARGE",
              description: null,
              serviceVisitId: "visit_2",
              createdAt: secondVisit,
            },
            {
              id: "entry_credit_1",
              jobId: "job_week",
              amountCents: -1500,
              type: "CREDIT",
              description: "Skip credit",
              serviceVisitId: "visit_skip",
              createdAt: secondVisit,
            },
          ]),
          updateMany: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });

    const updateManySpy = vi
      .spyOn(prismaMock.customerBillingLedgerEntry, "updateMany")
      .mockResolvedValue({ count: 3 });

    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: null });

    stripeInvoiceCreate.mockResolvedValue({
      id: "in_week",
      currency: "usd",
      status: "draft",
    });

    stripeInvoiceItemCreate
      .mockResolvedValueOnce({ id: "ii_week_charge" })
      .mockResolvedValueOnce({ id: "ii_week_credit" });

    stripeInvoiceFinalize.mockResolvedValue({ id: "in_week", status: "open" });

    const result = await processPendingLedgerEntriesForJob("job_week");

    expect(result.status).toBe("invoiced");
    if (result.status !== "invoiced") {
      throw new Error("Expected invoiced status");
    }
    expect(result.totalAmountCents).toBe(5500);
    expect(stripeInvoiceItemCreate).toHaveBeenCalledTimes(2);

    expect(stripeInvoiceItemCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        customer: "cus_week",
        invoice: "in_week",
        amount: 7000,
        description: expect.stringContaining("Service visits - Cycle"),
        metadata: expect.objectContaining({
          sourceType: "CHARGE",
          ledgerEntryIds: expect.stringContaining("entry_visit_1"),
        }),
      }),
    );

    expect(stripeInvoiceItemCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        amount: -1500,
        description: "Skip credit",
        metadata: expect.objectContaining({ sourceType: "CREDIT" }),
      }),
    );

    expect(updateManySpy).toHaveBeenCalledTimes(2);
    expect(updateManySpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["entry_visit_1", "entry_visit_2"] },
        }),
        data: expect.objectContaining({
          stripeInvoiceItemId: "ii_week_charge",
        }),
      }),
    );

    expect(updateManySpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["entry_credit_1"] } }),
        data: expect.objectContaining({ stripeInvoiceItemId: "ii_week_credit" }),
      }),
    );
  });

  it("groups per-visit charges into cycle line items with credits aggregated", async () => {
    const plan = {
      id: "plan_job_per_visit",
      jobId: "job_per_visit_group",
      billingPreference: "per-visit" as const,
      stripeCustomerId: "cus_per_visit_group",
      trialEndsAt: null,
      metadata: {
        billingAutomation: {
          billingCadenceDays: 7,
          trialStartsAt: "2024-02-05T00:00:00.000Z",
        },
      },
    };

    prismaMock.customerBillingPlan.findUnique.mockResolvedValue(plan);

    const firstVisit = new Date("2024-02-05T15:00:00Z");
    const secondVisit = new Date("2024-02-07T16:30:00Z");

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        customerBillingLedgerEntry: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "entry_pv_1",
              jobId: plan.jobId,
              amountCents: 3000,
              type: "CHARGE",
              description: null,
              serviceVisitId: "visit_pv_1",
              createdAt: firstVisit,
            },
            {
              id: "entry_pv_2",
              jobId: plan.jobId,
              amountCents: 3000,
              type: "CHARGE",
              description: null,
              serviceVisitId: "visit_pv_2",
              createdAt: secondVisit,
            },
            {
              id: "entry_pv_credit",
              jobId: plan.jobId,
              amountCents: -1000,
              type: "CREDIT",
              description: "Skip credit",
              serviceVisitId: "visit_pv_skip",
              createdAt: secondVisit,
            },
          ]),
          updateMany: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });

    const updateManySpy = vi
      .spyOn(prismaMock.customerBillingLedgerEntry, "updateMany")
      .mockResolvedValue({ count: 3 });

    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: null });

    stripeInvoiceCreate.mockResolvedValue({
      id: "in_pv",
      currency: "usd",
      status: "draft",
    });

    stripeInvoiceItemCreate
      .mockResolvedValueOnce({ id: "ii_pv_charge" })
      .mockResolvedValueOnce({ id: "ii_pv_credit" });

    stripeInvoiceFinalize.mockResolvedValue({ id: "in_pv", status: "open" });

    const result = await processPendingLedgerEntriesForJob(plan.jobId);

    expect(result.status).toBe("invoiced");
    if (result.status !== "invoiced") {
      throw new Error("Expected invoiced status");
    }
    expect(result.totalAmountCents).toBe(5000);
    expect(stripeInvoiceItemCreate).toHaveBeenCalledTimes(2);

    expect(updateManySpy).toHaveBeenCalledTimes(2);
    expect(updateManySpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["entry_pv_1", "entry_pv_2"] },
        }),
        data: expect.objectContaining({
          stripeInvoiceItemId: "ii_pv_charge",
        }),
      }),
    );
    expect(updateManySpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["entry_pv_credit"] } }),
        data: expect.objectContaining({ stripeInvoiceItemId: "ii_pv_credit" }),
      }),
    );
  });

  it("only bills executed daily visits and nets skip credits during the weekly cycle", async () => {
    const plan = {
      id: "plan_daily_week",
      jobId: "job_daily_week",
      billingPreference: "weekly" as const,
      stripeCustomerId: "cus_daily_week",
      trialEndsAt: null,
      metadata: {
        billingAutomation: {
          billingCadenceDays: 7,
          trialStartsAt: "2025-03-03T00:00:00.000Z",
        },
      },
    };

    prismaMock.customerBillingPlan.findUnique.mockResolvedValue(plan);

    const cycleStart = new Date("2025-03-03T14:00:00Z");
    const visitAmounts = [2200, 2200, 2200, 2200, 2200];
    const visitEntries = visitAmounts.map((amount, index) => ({
      id: `entry_daily_${index}`,
      jobId: plan.jobId,
      amountCents: amount,
      type: "CHARGE" as const,
      description: null,
      serviceVisitId: `visit_executed_${index}`,
      createdAt: new Date(cycleStart.getTime() + index * 24 * 60 * 60 * 1000),
      metadata: {
        serviceFrequency: "daily",
        weekendUpgrade: true,
      } as Record<string, unknown>,
    }));

    const skipCredits = [
      {
        id: "entry_credit_weekend_1",
        jobId: plan.jobId,
        amountCents: -2200,
        type: "CREDIT" as const,
        description: "Skipped visit credit",
        serviceVisitId: "visit_skipped_1",
        createdAt: new Date("2025-03-07T14:00:00Z"),
      },
      {
        id: "entry_credit_weekend_2",
        jobId: plan.jobId,
        amountCents: -2200,
        type: "CREDIT" as const,
        description: "Skipped visit credit",
        serviceVisitId: "visit_skipped_2",
        createdAt: new Date("2025-03-08T14:00:00Z"),
      },
    ];

    prismaMock.$transaction.mockImplementation(async (callback: any) => {
      const tx = {
        customerBillingLedgerEntry: {
          findMany: vi.fn().mockResolvedValue([...visitEntries, ...skipCredits]),
          updateMany: vi.fn().mockResolvedValue(undefined),
        },
      };
      return callback(tx);
    });

    const updateManySpy = vi
      .spyOn(prismaMock.customerBillingLedgerEntry, "updateMany")
      .mockResolvedValue({ count: 7 });

    prismaMock.customerBillingPlan.update.mockResolvedValue({ trialEndsAt: null });

    stripeInvoiceCreate.mockResolvedValue({
      id: "in_daily_week",
      currency: "usd",
      status: "draft",
    });

    stripeInvoiceItemCreate.mockResolvedValue({ id: "ii_daily_week_fallback" });
    stripeInvoiceItemCreate
      .mockResolvedValueOnce({ id: "ii_daily_week_charge" })
      .mockResolvedValueOnce({ id: "ii_daily_week_credit" });

    stripeInvoiceFinalize.mockResolvedValue({ id: "in_daily_week", status: "open" });

    const result = await processPendingLedgerEntriesForJob(plan.jobId);

    expect(result.status).toBe("invoiced");
    if (result.status !== "invoiced") {
      throw new Error("Expected invoiced status");
    }

    // 5 executed visits less 2 skip credits => net 3 visits billed
    expect(result.totalAmountCents).toBe(6600);

    const invoiceCalls = stripeInvoiceItemCreate.mock.calls.map((call) => call[0]);
    expect(invoiceCalls.length).toBeGreaterThanOrEqual(2);
    const chargeArgs = invoiceCalls[0] as Record<string, unknown>;
    const creditArgs = invoiceCalls[1] as Record<string, unknown>;

    expect(chargeArgs).toMatchObject({
      amount: 11000,
      description: expect.stringContaining("5 visits; Mon–Sun coverage"),
    });
    expect(creditArgs).toMatchObject({ amount: -4400 });

    // Ensure the executed visit entries were tied to the charge line
    expect(updateManySpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: {
            in: visitEntries.map((entry) => entry.id),
          },
        }),
        data: expect.objectContaining({ stripeInvoiceItemId: "ii_daily_week_charge" }),
      }),
    );

    expect(updateManySpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: skipCredits.map((entry) => entry.id) },
        }),
        data: expect.objectContaining({ stripeInvoiceItemId: "ii_daily_week_credit" }),
      }),
    );
  });
});

describe("voidLedgerEntries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("marks payouts void when related ledger entries are voided", async () => {
    prismaMock.customerBillingLedgerEntry.updateMany.mockResolvedValue(undefined);
    prismaMock.customerBillingLedgerEntry.findMany.mockResolvedValue([
      { id: "entry_a", serviceVisitId: "visit_a", metadata: null },
      { id: "entry_b", serviceVisitId: "visit_b", metadata: { source: "test" } },
    ]);
    prismaMock.customerBillingLedgerEntry.update.mockResolvedValue(undefined);
    prismaMock.visitPayout.updateMany.mockResolvedValue({ count: 2 });
    prismaMock.$transaction.mockResolvedValue(undefined as any);

    await voidLedgerEntries(["entry_a", "entry_b"], "refund");

    expect(prismaMock.customerBillingLedgerEntry.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "VOID" }),
      }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.visitPayout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceVisitId: { in: ["visit_a", "visit_b"] },
        }),
      }),
    );
  });
});
