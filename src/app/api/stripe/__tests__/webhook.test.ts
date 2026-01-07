import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  handleSubscriptionUpdate,
  handleSubscriptionCancellation,
} from "@/lib/stripe/webhook-handlers";

const prismaMock = vi.hoisted(() => ({
  job: {
    updateMany: vi.fn(),
  },
  serviceVisit: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/billing/invoices", () => ({
  syncInvoiceWithLedger: vi.fn(),
  handleInvoicePaid: vi.fn(),
  handleInvoicePaymentFailed: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
  },
}));

describe("Stripe subscription webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a job paused when the subscription is past due", async () => {
    await handleSubscriptionUpdate({
      status: "past_due",
      metadata: {
        jobId: "job_789",
      },
    });

    expect(prismaMock.job.updateMany).toHaveBeenCalledWith({
      where: { id: "job_789" },
      data: { status: "PAUSED" },
    });
  });

  it("cancels a job when the subscription is deleted", async () => {
    await handleSubscriptionCancellation({
      metadata: {
        jobId: "job_cancel",
      },
    });

    expect(prismaMock.job.updateMany).toHaveBeenCalledWith({
      where: { id: "job_cancel" },
      data: expect.objectContaining({
        status: "CANCELED",
        cancelledAt: expect.any(Date),
      }),
    });
  });
});
