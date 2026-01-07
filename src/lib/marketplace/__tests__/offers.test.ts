import { beforeEach, describe, expect, it, vi } from "vitest";
import { Frequency, ServiceStatus, VisitOfferStatus } from "@prisma/client";

import { loadScooperOfferFeed } from "@/lib/marketplace/offers";

const prismaMock = vi.hoisted(() => ({
  visitOffer: {
    findMany: vi.fn(),
  },
  visitCompSchedule: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("loadScooperOfferFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.visitCompSchedule.findFirst.mockResolvedValue(null);
  });

  it("treats visit handoffs from recurring jobs as one-time offers", async () => {
    prismaMock.visitOffer.findMany.mockResolvedValue([
      {
        id: "offer_1",
        orgId: "org",
        tileId: "tile",
        serviceVisitId: "visit_1",
        expiresAt: null,
        status: VisitOfferStatus.PENDING,
        priority: 0,
        dispatchStrategy: null,
        offeredToId: null,
        metadata: null,
        tile: {
          id: "tile",
          slug: "tile",
          name: "Tile",
          status: "ACTIVE",
        },
        serviceVisit: {
          scheduledDate: new Date("2026-01-01T08:00:00Z"),
          status: ServiceStatus.SCHEDULED,
          assignedToId: null,
          backupAssignedToId: null,
          preferredTimeWindowSlug: null,
          preferredTimeWindow: null,
          metadata: {
            handoff: { type: "visit", at: new Date().toISOString() },
          },
          revenueCents: 2500,
          serviceType: null,
          requiredCertifications: null,
          customer: {
            id: "cust",
            name: "Customer",
            addressLine1: "123 Main",
            city: "City",
            zip: "55555",
            latitude: null,
            longitude: null,
            dogs: [],
          },
          job: {
            id: "job",
            frequency: Frequency.WEEKLY,
            primaryScooperId: "primary_scooper",
          },
        },
      },
    ]);

    const offers = await loadScooperOfferFeed({
      orgId: "org",
      userId: "other_scooper",
    });

    expect(offers[0]?.isRecurring).toBe(false);
    expect(offers[0]?.handoffType).toBe("visit");
  });

  it("does not show recurring acceptance when a job is owned by another scooper", async () => {
    prismaMock.visitOffer.findMany.mockResolvedValue([
      {
        id: "offer_2",
        orgId: "org",
        tileId: "tile",
        serviceVisitId: "visit_2",
        expiresAt: null,
        status: VisitOfferStatus.PENDING,
        priority: 0,
        dispatchStrategy: null,
        offeredToId: null,
        metadata: null,
        tile: null,
        serviceVisit: {
          scheduledDate: new Date("2026-01-02T08:00:00Z"),
          status: ServiceStatus.SCHEDULED,
          assignedToId: null,
          backupAssignedToId: null,
          preferredTimeWindowSlug: null,
          preferredTimeWindow: null,
          metadata: {},
          revenueCents: 2500,
          serviceType: null,
          requiredCertifications: null,
          customer: null,
          job: {
            id: "job",
            frequency: Frequency.TWICE_WEEKLY,
            primaryScooperId: "primary_scooper",
          },
        },
      },
    ]);

    const offers = await loadScooperOfferFeed({
      orgId: "org",
      userId: "different_scooper",
    });

    expect(offers[0]?.isRecurring).toBe(false);
  });

  it("keeps recurring acceptance for unassigned recurring jobs", async () => {
    prismaMock.visitOffer.findMany.mockResolvedValue([
      {
        id: "offer_3",
        orgId: "org",
        tileId: "tile",
        serviceVisitId: "visit_3",
        expiresAt: null,
        status: VisitOfferStatus.PENDING,
        priority: 0,
        dispatchStrategy: null,
        offeredToId: null,
        metadata: null,
        tile: null,
        serviceVisit: {
          scheduledDate: new Date("2026-01-03T08:00:00Z"),
          status: ServiceStatus.SCHEDULED,
          assignedToId: null,
          backupAssignedToId: null,
          preferredTimeWindowSlug: null,
          preferredTimeWindow: null,
          metadata: {},
          revenueCents: 2500,
          serviceType: null,
          requiredCertifications: null,
          customer: null,
          job: {
            id: "job",
            frequency: Frequency.WEEKLY,
            primaryScooperId: null,
          },
        },
      },
    ]);

    const offers = await loadScooperOfferFeed({
      orgId: "org",
      userId: "candidate_scooper",
    });

    expect(offers[0]?.isRecurring).toBe(true);
  });
});
