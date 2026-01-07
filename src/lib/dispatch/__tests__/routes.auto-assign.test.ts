import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RouteStopStatus } from "@prisma/client";

const prismaMock = vi.hoisted(() => ({
  serviceVisit: {
    findUnique: vi.fn(),
  },
  routeInstance: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  routeStop: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const enqueueOfferPublishingMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());
const infoMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/jobs/marketplaceOfferPublisher", () => ({
  enqueueOfferPublishing: enqueueOfferPublishingMock,
}));

vi.mock("@/lib/log", () => ({
  warn: warnMock,
  info: infoMock,
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/dispatch/schema-guard", () => ({
  ensureDispatchSchema: vi.fn().mockResolvedValue(undefined),
}));

// import after mocks are registered
import { autoAssignVisitToRoute } from "@/lib/dispatch/routes";

function setupTransactionMock(createdRoute: any, visitId: string, orgId: string) {
  prismaMock.$transaction.mockImplementation(async (callback: any) => {
    const txRouteStopCreate = vi.fn().mockImplementation(async ({ data }) => ({
      id: `tx-stop-${Math.random().toString(36).slice(2)}`,
      ...(data as { status: RouteStopStatus }),
    }));

    const tx = {
      routeInstance: {
        create: vi.fn().mockResolvedValue({ id: createdRoute.id }),
        findUnique: vi.fn().mockResolvedValue(createdRoute),
      },
      serviceVisit: {
        findMany: vi.fn().mockResolvedValue([
          { id: visitId, orgId, jobId: "job-1" },
        ]),
      },
      routeStop: {
        create: txRouteStopCreate,
      },
    };

    const result = await callback(tx);
    return result;
  });
}

describe("autoAssignVisitToRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("warns and republishes offers when weekend routes lack technicians and no candidate route is viable", async () => {
    const visitId = "visit-1";
    const orgId = "org-1";
    const scheduledDate = new Date("2025-04-05T15:00:00Z"); // Saturday

    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      orgId,
      jobId: "job-1",
      scheduledDate,
      routeStop: null,
      job: {
        orgId,
        tile: { slug: "tile-midtown" },
      },
      customer: {
        id: "cust-1",
        latitude: 44.9,
        longitude: -93.3,
      },
    });

    prismaMock.routeInstance.findMany.mockResolvedValue([
      {
        id: "route-existing",
        orgId,
        scheduledDate,
        technicianId: null,
        stops: [
          {
            id: "stop-1",
            position: 0,
            serviceVisit: {
              customer: {
                latitude: null,
                longitude: null,
              },
            },
          },
        ],
      },
    ]);

    const createdRoute = {
      id: "route-created",
      orgId,
      scheduledDate,
      stops: [],
    };

    setupTransactionMock(createdRoute, visitId, orgId);

    const result = await autoAssignVisitToRoute(visitId);

    expect(result).toEqual(createdRoute);

    // first warning: weekend routes without technicians
    expect(warnMock).toHaveBeenCalledWith(
      "dispatch.autoAssign",
      expect.objectContaining({
        orgId,
        visitId,
        reason: "weekend-routes-without-technicians",
      }),
    );

    // fallback warning when no candidate route is viable
    expect(warnMock).toHaveBeenCalledWith(
      "dispatch.autoAssign",
      expect.objectContaining({
        orgId,
        visitId,
        reason: expect.stringMatching(/^(no-candidate-routes|missing-geo-coordinates)$/),
        weekend: true,
      }),
    );

    // Offers should be republished for the tile twice (initial + fallback)
    expect(enqueueOfferPublishingMock).toHaveBeenCalledTimes(2);
    const publishedTiles = enqueueOfferPublishingMock.mock.calls.map((call) => call[0]?.tileSlugs?.[0]);
    expect(publishedTiles).toEqual(["tile-midtown", "tile-midtown"]);

    expect(infoMock).toHaveBeenCalledWith(
      "dispatch.autoAssign.candidates",
      expect.objectContaining({
        orgId,
        visitId,
        totalRoutes: 1,
        scored: 1,
        bestRouteId: "route-existing",
        bestStopCount: 1,
        weekend: true,
      }),
    );
  });

  it("assigns to existing weekend route when technician is present without republishing offers", async () => {
    const visitId = "visit-2";
    const orgId = "org-2";
    const scheduledDate = new Date("2025-04-06T15:00:00Z"); // Sunday

    prismaMock.serviceVisit.findUnique.mockResolvedValue({
      id: visitId,
      orgId,
      jobId: "job-2",
      scheduledDate,
      routeStop: null,
      job: {
        orgId,
        tile: { slug: "tile-west" },
      },
      customer: {
        id: "cust-2",
        latitude: 44.95,
        longitude: -93.27,
      },
    });

    prismaMock.routeInstance.findMany.mockResolvedValue([
      {
        id: "route-tech",
        orgId,
        scheduledDate,
        technicianId: "tech-1",
        stops: [
          {
            id: "stop-a",
            position: 0,
            serviceVisit: {
              customer: {
                latitude: 44.951,
                longitude: -93.26,
              },
            },
          },
        ],
      },
    ]);

    prismaMock.routeStop.create.mockResolvedValue({
      id: "stop-new",
      position: 1,
      status: "PENDING",
    });

    prismaMock.$transaction.mockResolvedValue({
      id: "route-tech",
      orgId,
      scheduledDate,
      technicianId: "tech-1",
      stops: [
        {
          id: "stop-a",
          position: 0,
          serviceVisit: {
            customer: { latitude: 44.951, longitude: -93.26 },
          },
        },
        {
          id: "stop-new",
          position: 1,
          serviceVisit: {
            customer: { latitude: 44.95, longitude: -93.27 },
          },
        },
      ],
    });

    prismaMock.routeInstance.findUnique.mockResolvedValue({
      id: "route-tech",
      orgId,
      scheduledDate,
      technicianId: "tech-1",
      stops: [
        {
          id: "stop-a",
          position: 0,
          serviceVisit: {
            customer: { latitude: 44.951, longitude: -93.26 },
          },
        },
        {
          id: "stop-new",
          position: 1,
          serviceVisit: {
            customer: { latitude: 44.95, longitude: -93.27 },
          },
        },
      ],
    });

    const result = await autoAssignVisitToRoute(visitId);

    expect(result?.id).toBe("route-tech");
    expect(prismaMock.routeStop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routeInstanceId: "route-tech",
          serviceVisitId: visitId,
        }),
      }),
    );
    expect(warnMock).not.toHaveBeenCalled();
    expect(enqueueOfferPublishingMock).not.toHaveBeenCalled();
  });
});
