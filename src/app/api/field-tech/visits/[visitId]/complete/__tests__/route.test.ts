import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { VisitMediaType } from "@prisma/client";

import { POST } from "../route";

const getScooperAuthMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  serviceVisit: {
    findUnique: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  dataReading: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  scooperProfile: {
    findUnique: vi.fn(),
  },
  scooperRoutePlan: {
    findFirst: vi.fn(),
  },
  customerBillingLedgerEntry: {
    findFirst: vi.fn(),
  },
  routeStop: {
    update: vi.fn(),
  },
}));

const upsertVisitInsightMock = vi.hoisted(() => vi.fn());
const awardScooperPointsMock = vi.hoisted(() => vi.fn());
const createVisitChargeEntryMock = vi.hoisted(() => vi.fn());
const createVisitCommunicationMock = vi.hoisted(() => vi.fn());
const updateVisitCommunicationStatusMock = vi.hoisted(() => vi.fn());
const sendSmsMock = vi.hoisted(() => vi.fn());
const sendTransactionalEmailMock = vi.hoisted(() => vi.fn());
const buildVisitCompletedEmailMock = vi.hoisted(() => vi.fn());
const createSignedUrlMock = vi.hoisted(() => vi.fn());
const normalizePhoneMock = vi.hoisted(() => vi.fn());
const upsertVisitPayoutMock = vi.hoisted(() => vi.fn());
const getPlanByJobIdMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/scooper", () => ({
  getScooperAuth: getScooperAuthMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/service-visits/insights", () => ({
  upsertVisitInsight: upsertVisitInsightMock,
}));

vi.mock("@/lib/service-visits/communications", () => ({
  createVisitCommunication: createVisitCommunicationMock,
  updateVisitCommunicationStatus: updateVisitCommunicationStatusMock,
}));

vi.mock("@/lib/sms", () => ({
  sendSms: sendSmsMock,
}));

vi.mock("@/lib/env", () => ({
  env: { STORAGE_BUCKET: undefined },
  getSiteUrl: () => "https://example.com",
}));

vi.mock("@/lib/supabase-admin", () => ({
  createSignedUrl: createSignedUrlMock,
}));

vi.mock("@/lib/phone", () => ({
  normalizePhone: normalizePhoneMock,
}));

vi.mock("@/lib/email", () => ({
  sendTransactionalEmail: sendTransactionalEmailMock,
}));

vi.mock("@/lib/email/templates", () => ({
  buildVisitCompletedEmail: buildVisitCompletedEmailMock,
}));

vi.mock("@/lib/marketplace/payouts", () => ({
  upsertVisitPayoutForVisit: upsertVisitPayoutMock,
}));

vi.mock("@/lib/billing/ledger", () => ({
  createVisitChargeEntry: createVisitChargeEntryMock,
}));

vi.mock("@/lib/billing/plan", () => ({
  getPlanByJobId: getPlanByJobIdMock,
}));

vi.mock("@/lib/field-tech/rewardEvents", () => ({
  awardScooperPoints: awardScooperPointsMock,
  SCOOPER_REWARD_EVENT_POINTS: { visitComplete: 5, detectionFlag: 2 },
  SCOOPER_VISIT_POINTS_CAP: 25,
}));

const createRequest = (body: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

const buildVisit = (billingPreference: "monthly" | "weekly") => ({
  id: "visit-1",
  orgId: "org-1",
  assignedToId: "scooper-1",
  scheduledDate: new Date("2025-04-01T09:00:00Z"),
  actualStart: null,
  actualEnd: null,
  metadata: {
    requiresGatePhoto: false,
    requiresBagDropPhoto: false,
  },
  customer: {
    id: "cust-1",
    name: "Customer",
    phone: null,
    email: null,
  },
  job: {
    id: "job-1",
    frequency: "WEEKLY",
    orgId: "org-1",
    customerId: "cust-1",
    perVisitRevenueCents: 4200,
    billingPlan: {
      billingPreference,
      perVisitAmountCents: 4200,
      metadata: {},
    },
  },
  media: [
    {
      id: "media-1",
      assetType: VisitMediaType.INSIGHTSCOOP,
      notes: null,
      storagePath: "insights.jpg",
    },
    {
      id: "media-2",
      assetType: VisitMediaType.OTHER,
      notes: "SANITATION_VIDEO",
      storagePath: "sanitation.mp4",
    },
  ],
  routeStop: null,
});

describe("visit completion billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getScooperAuthMock.mockResolvedValue({ userId: "scooper-1", orgId: "org-1" });
    upsertVisitInsightMock.mockResolvedValue({ wellnessFlag: false });
    upsertVisitPayoutMock.mockResolvedValue({ totalAmountCents: 500 });
    createVisitCommunicationMock.mockResolvedValue({ id: "comm-1" });
    updateVisitCommunicationStatusMock.mockResolvedValue({});
    normalizePhoneMock.mockReturnValue(null);
    prismaMock.serviceVisit.update.mockResolvedValue({});
    prismaMock.dataReading.findFirst.mockResolvedValue(null);
    prismaMock.dataReading.create.mockResolvedValue({});
    prismaMock.scooperProfile.findUnique.mockResolvedValue(null);
    prismaMock.scooperRoutePlan.findFirst.mockResolvedValue(null);
    prismaMock.customerBillingLedgerEntry.findFirst.mockResolvedValue(null);
    prismaMock.serviceVisit.findFirst.mockResolvedValue(null);
  });

  it("does not create per-visit charges for monthly plans", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue(
      buildVisit("monthly"),
    );

    const response = await POST(
      createRequest({
        color: "Brown",
        consistency: "Solid",
        content: "Typical",
        notificationChannel: "SMS",
      }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(200);
    expect(createVisitChargeEntryMock).not.toHaveBeenCalled();
  });

  it("creates per-visit charges for weekly plans", async () => {
    prismaMock.serviceVisit.findUnique.mockResolvedValue(
      buildVisit("weekly"),
    );

    const response = await POST(
      createRequest({
        color: "Brown",
        consistency: "Solid",
        content: "Typical",
        notificationChannel: "SMS",
      }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(200);
    expect(createVisitChargeEntryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        billingPreference: "weekly",
      }),
    );
  });
});
