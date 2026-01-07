import { beforeEach, describe, expect, it, vi } from "vitest";

import { createVisitChargeEntry } from "@/lib/billing/ledger";

const prismaMock = vi.hoisted(() => ({
  customerBillingLedgerEntry: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

const processPendingMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ status: "nothing-to-invoice" }),
);

vi.mock("@/lib/billing/invoice-processor", () => ({
  processPendingLedgerEntriesForJob: processPendingMock,
}));

vi.mock("@/lib/jobs/billingInvoiceQueue", () => ({
  enqueueBillingInvoiceJob: vi.fn(),
}));

describe("createVisitChargeEntry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    processPendingMock.mockResolvedValue({ status: "nothing-to-invoice" });
  });

  it("skips creating visit charges for monthly plans", async () => {
    const result = await createVisitChargeEntry({
      orgId: "org_1",
      jobId: "job_1",
      customerId: "cust_1",
      serviceVisitId: "visit_1",
      billingPreference: "monthly",
      amountCents: 1200,
    });

    expect(prismaMock.customerBillingLedgerEntry.create).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
