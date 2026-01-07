import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/customer/billing/ledger/route";

const sessionMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  customer: {
    findFirst: vi.fn(),
  },
  customerBillingLedgerEntry: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  safeGetServerSession: sessionMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("/api/customer/billing/ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated access", async () => {
    sessionMock.mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("returns ledger summary for authenticated customer", async () => {
    sessionMock.mockResolvedValue({ user: { email: "user@example.com" } });
    prismaMock.customer.findFirst.mockResolvedValue({ id: "cust_123" });
    prismaMock.customerBillingLedgerEntry.findMany.mockResolvedValue([
      {
        id: "entry_1",
        type: "CHARGE",
        status: "APPLIED",
        amountCents: 2500,
        description: "Monthly plan",
        createdAt: new Date("2025-01-05T12:00:00Z"),
        appliedAt: new Date("2025-01-05T12:00:00Z"),
        voidedAt: null,
        stripeInvoiceId: null,
        stripeInvoiceItemId: null,
        serviceVisitId: null,
        metadata: null,
      },
      {
        id: "entry_2",
        type: "CREDIT",
        status: "PENDING",
        amountCents: -500,
        description: "Skip credit",
        createdAt: new Date("2025-01-06T12:00:00Z"),
        appliedAt: null,
        voidedAt: null,
        stripeInvoiceId: null,
        stripeInvoiceItemId: null,
        serviceVisitId: null,
        metadata: null,
      },
    ]);

    const response = await GET();
    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.ok).toBe(true);
    expect(payload.data.entries).toHaveLength(2);
    expect(payload.data.totals.balanceDueCents).toBe(2000);
    expect(payload.data.totals.pendingCents).toBe(-500);
    expect(payload.data.entries[0]).toEqual(
      expect.objectContaining({
        id: "entry_1",
        type: "CHARGE",
      }),
    );
  });
});
