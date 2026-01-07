import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleOfferAutoAssign } from "@/lib/jobs/marketplaceOfferAutoAssign";

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
  Job: class {},
  JobsOptions: class {},
}));

const prismaMock = vi.hoisted(() => ({
  serviceVisit: {
    findMany: vi.fn(),
  },
  scooperAvailability: {
    findMany: vi.fn(),
  },
  visitOffer: {
    update: vi.fn(),
    create: vi.fn(),
  },
}));

const infoMock = vi.hoisted(() => vi.fn());
const getBusinessConfigMock = vi.hoisted(() => vi.fn());
const sendPushMock = vi.hoisted(() => vi.fn());
const peekStrikeCountMock = vi.hoisted(() => vi.fn());
const readAutoAssignStateMock = vi.hoisted(() => vi.fn());
const markAutoAssignAttemptMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/log", () => ({
  info: infoMock,
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/business-config", () => ({
  getBusinessConfig: getBusinessConfigMock,
}));

vi.mock("@/lib/notifications/push", () => ({
  sendScooperDirectOfferPush: sendPushMock,
}));

vi.mock("@/lib/marketplace/discipline", () => ({
  peekStrikeCount: peekStrikeCountMock,
  STRIKE_LIMIT: 3,
}));

vi.mock("@/lib/marketplace/offer-auto-assign", () => ({
  readAutoAssignState: readAutoAssignStateMock,
  markAutoAssignAttempt: markAutoAssignAttemptMock,
}));

describe("handleOfferAutoAssign", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-04-01T10:00:00Z"));
    vi.clearAllMocks();

    getBusinessConfigMock.mockResolvedValue({
      operations: {
        offerAutoAssignLeadHours: 6,
        offerDirectHoldMinutes: 30,
      },
    });

    peekStrikeCountMock.mockReturnValue({
      count: 0,
      windowStart: new Date("2025-01-01T00:00:00Z").toISOString(),
    });
    readAutoAssignStateMock.mockReturnValue({ declinedBy: [] });
    markAutoAssignAttemptMock.mockImplementation((metadata: any, options: any) => ({
      ...metadata,
      autoAssign: {
        lastOfferedToId: options.userId,
        lastAttemptAt: options.now.toISOString(),
      },
    }));
    sendPushMock.mockResolvedValue(undefined);
  });

  it("auto-assigns the highest rated eligible scooper", async () => {
    const now = new Date();
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "visit-1",
        orgId: "org",
        tileId: "tile-1",
        scheduledDate: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        preferredTimeWindow: "Morning window",
        preferredTimeWindowSlug: "morning",
        metadata: null,
        requiredCertifications: [],
        visitOffers: [
          {
            id: "offer-1",
            status: "PENDING",
            offeredToId: null,
            expiresAt: null,
            metadata: {},
          },
        ],
      },
    ]);

    prismaMock.scooperAvailability.findMany.mockResolvedValue([
      {
        scooper: {
          id: "scooper-1",
          userId: "user-1",
          status: "CERTIFIED",
          metadata: { avgRating: 4.4, lifetimeStops: 120 },
          certifications: [{ type: "BASIC", status: "ACTIVE" }],
        },
      },
      {
        scooper: {
          id: "scooper-2",
          userId: "user-2",
          status: "CERTIFIED",
          metadata: { avgRating: 4.9, lifetimeStops: 15 },
          certifications: [{ type: "BASIC", status: "ACTIVE" }],
        },
      },
    ]);

    await handleOfferAutoAssign({ orgId: "org" });

    expect(prismaMock.visitOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "offer-1" },
        data: expect.objectContaining({
          offeredToId: "user-2",
          dispatchStrategy: "auto_assign",
        }),
      }),
    );
    expect(sendPushMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-2" }),
    );
  });

  it("skips visits with an active direct offer", async () => {
    const now = new Date();
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "visit-2",
        orgId: "org",
        tileId: "tile-2",
        scheduledDate: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        preferredTimeWindow: "Morning window",
        preferredTimeWindowSlug: "morning",
        metadata: null,
        requiredCertifications: [],
        visitOffers: [
          {
            id: "offer-2",
            status: "PENDING",
            offeredToId: "user-active",
            expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
            metadata: {},
          },
        ],
      },
    ]);

    const result = await handleOfferAutoAssign({ orgId: "org" });

    expect(result.skippedActiveDirect).toBe(1);
    expect(prismaMock.visitOffer.update).not.toHaveBeenCalled();
    expect(prismaMock.visitOffer.create).not.toHaveBeenCalled();
  });

  it("creates a direct offer when no pending offer exists", async () => {
    const now = new Date();
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "visit-3",
        orgId: "org",
        tileId: "tile-3",
        scheduledDate: new Date(now.getTime() + 60 * 60 * 1000),
        preferredTimeWindow: "Morning window",
        preferredTimeWindowSlug: "morning",
        metadata: null,
        requiredCertifications: [],
        visitOffers: [],
      },
    ]);

    prismaMock.scooperAvailability.findMany.mockResolvedValue([
      {
        scooper: {
          id: "scooper-3",
          userId: "user-3",
          status: "CERTIFIED",
          metadata: { avgRating: 4.2, lifetimeStops: 50 },
          certifications: [{ type: "BASIC", status: "ACTIVE" }],
        },
      },
    ]);

    await handleOfferAutoAssign({ orgId: "org" });

    expect(prismaMock.visitOffer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          serviceVisitId: "visit-3",
          offeredToId: "user-3",
          dispatchStrategy: "auto_assign",
        }),
      }),
    );
  });

  it("respects declined scoopers when selecting candidates", async () => {
    readAutoAssignStateMock.mockReturnValue({ declinedBy: ["user-4"] });

    const now = new Date();
    prismaMock.serviceVisit.findMany.mockResolvedValue([
      {
        id: "visit-4",
        orgId: "org",
        tileId: "tile-4",
        scheduledDate: new Date(now.getTime() + 60 * 60 * 1000),
        preferredTimeWindow: "Morning window",
        preferredTimeWindowSlug: "morning",
        metadata: null,
        requiredCertifications: [],
        visitOffers: [
          {
            id: "offer-4",
            status: "PENDING",
            offeredToId: null,
            expiresAt: null,
            metadata: {},
          },
        ],
      },
    ]);

    prismaMock.scooperAvailability.findMany.mockResolvedValue([
      {
        scooper: {
          id: "scooper-4",
          userId: "user-4",
          status: "CERTIFIED",
          metadata: { avgRating: 4.9, lifetimeStops: 10 },
          certifications: [{ type: "BASIC", status: "ACTIVE" }],
        },
      },
      {
        scooper: {
          id: "scooper-5",
          userId: "user-5",
          status: "CERTIFIED",
          metadata: { avgRating: 4.1, lifetimeStops: 40 },
          certifications: [{ type: "BASIC", status: "ACTIVE" }],
        },
      },
    ]);

    await handleOfferAutoAssign({ orgId: "org" });

    expect(prismaMock.visitOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "offer-4" },
        data: expect.objectContaining({
          offeredToId: "user-5",
        }),
      }),
    );
  });

  it("uses the configured lead hours to bound the auto-assign window", async () => {
    getBusinessConfigMock.mockResolvedValue({
      operations: {
        offerAutoAssignLeadHours: 2,
        offerDirectHoldMinutes: 30,
      },
    });

    prismaMock.serviceVisit.findMany.mockResolvedValue([]);

    const now = new Date();
    await handleOfferAutoAssign({ orgId: "org" });

    const callArgs = prismaMock.serviceVisit.findMany.mock.calls[0]?.[0];
    expect(callArgs?.where?.scheduledDate?.lte).toEqual(
      new Date(now.getTime() + 2 * 60 * 60 * 1000),
    );
  });
});
