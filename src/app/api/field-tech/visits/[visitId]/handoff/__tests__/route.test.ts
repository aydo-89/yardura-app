import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "../route";
import { ServiceStatus } from "@prisma/client";
import type { NextRequest } from "next/server";

const authMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  scooperProfile: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
}));
const disciplineMock = vi.hoisted(() => vi.fn());
const enqueueMock = vi.hoisted(() => vi.fn());
const infoMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/scooper", () => ({
  getScooperAuth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/marketplace/discipline", () => ({
  LATE_RELEASE_LIMIT: 5,
  EARLY_RELEASE_LIMIT: 10,
}));

vi.mock("@/lib/marketplace/discipline-events", () => ({
  recordDisciplineEvent: disciplineMock,
}));

vi.mock("@/lib/jobs/marketplaceOfferPublisher", () => ({
  enqueueOfferPublishing: enqueueMock,
}));

vi.mock("@/lib/log", () => ({
  info: infoMock,
  warn: warnMock,
  error: vi.fn(),
  debug: vi.fn(),
}));

const createRequest = (body: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

const buildTransactionMocks = () => {
  const tx = {
    scooperProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    serviceVisit: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    visitOffer: {
      updateMany: vi.fn(),
    },
    routeStop: {
      update: vi.fn(),
    },
  };

  prismaMock.$transaction.mockImplementation(async (callback: any) => callback(tx));
  return tx;
};

describe("field-tech visit handoff route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({
      userId: "scooper-1",
    });
  });

  it("logs and returns success when a handoff is processed", async () => {
    const tx = buildTransactionMocks();

    tx.scooperProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      orgId: "org-1",
      metadata: null,
    });

    const futureDate = new Date(Date.now() + 72 * 60 * 60 * 1000);
    tx.serviceVisit.findUnique.mockResolvedValue({
      id: "visit-1",
      status: ServiceStatus.SCHEDULED,
      assignedToId: "scooper-1",
      notes: null,
      scheduledDate: futureDate,
      job: {
        tile: { slug: "tile-1" },
      },
      routeStop: { id: "stop-1" },
    });

    disciplineMock.mockResolvedValue({
      currentCount: 1,
      allowed: true,
    });

    const response = await POST(
      createRequest({ reason: "family emergency" }),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(200);
    expect(infoMock).toHaveBeenCalledWith("marketplace.visitHandoff", {
      orgId: "org-1",
      visitId: "visit-1",
      tileSlug: "tile-1",
      releaseCount: 1,
      releaseLimit: expect.any(Number),
      isLateRelease: false,
      reason: "family emergency",
    });
    expect(enqueueMock).toHaveBeenCalledWith({
      orgId: "org-1",
      tileSlugs: ["tile-1"],
    });
  });

  it("warns when the quarterly visit handoff limit is reached", async () => {
    const tx = buildTransactionMocks();

    tx.scooperProfile.findUnique.mockResolvedValue({
      id: "profile-1",
      orgId: "org-1",
      metadata: null,
    });

    const soonDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    tx.serviceVisit.findUnique.mockResolvedValue({
      id: "visit-1",
      status: ServiceStatus.SCHEDULED,
      assignedToId: "scooper-1",
      notes: null,
      scheduledDate: soonDate,
      job: {
        tile: { slug: "tile-1" },
      },
      routeStop: { id: "stop-1" },
    });

    disciplineMock.mockResolvedValue({
      currentCount: 5,
      allowed: false,
    });

    const response = await POST(
      createRequest({}),
      { params: Promise.resolve({ visitId: "visit-1" }) },
    );

    expect(response.status).toBe(429);
    expect(warnMock).toHaveBeenCalledWith(
      "marketplace.visitHandoff",
      expect.objectContaining({
        visitId: "visit-1",
        reason: "late_release_limit",
        limit: 5,
      }),
    );
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
