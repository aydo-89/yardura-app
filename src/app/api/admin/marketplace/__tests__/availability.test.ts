import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "@/app/api/admin/marketplace/availability/route";
import { AvailabilityWindow } from "@prisma/client";
import type { NextRequest } from "next/server";

const sessionMock = vi.hoisted(() => vi.fn());
const resolveBusinessIdMock = vi.hoisted(() => vi.fn());
const listAvailabilityMock = vi.hoisted(() => vi.fn());
const updateAvailabilityMock = vi.hoisted(() => vi.fn());
const listServiceAreasMock = vi.hoisted(() => vi.fn());
const getTileBySlugMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  serviceTile: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  scooperProfile: {
    findFirst: vi.fn(),
  },
}));
const infoMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  safeGetServerSession: sessionMock,
}));

vi.mock("@/lib/tenant", () => ({
  resolveBusinessId: resolveBusinessIdMock,
}));

vi.mock("@/lib/marketplace", () => ({
  listScooperAvailability: listAvailabilityMock,
  updateScooperAvailability: updateAvailabilityMock,
}));

vi.mock("@/lib/tiles/service-areas", () => ({
  listServiceAreas: listServiceAreasMock,
}));

vi.mock("@/lib/tiles/repository", () => ({
  getTileRepository: () => ({
    getTileBySlug: getTileBySlugMock,
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/log", () => ({
  info: infoMock,
  warn: warnMock,
  error: vi.fn(),
  debug: vi.fn(),
}));

const createRequest = (body?: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

describe("/api/admin/marketplace/availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.mockResolvedValue({
      user: { id: "admin" },
      userRole: "ADMIN",
    });
    resolveBusinessIdMock.mockResolvedValue("org_123");
    prismaMock.scooperProfile.findFirst.mockResolvedValue({ id: "profile-1" });
  });

  it("returns tiles and scooper availability for trusted admins", async () => {
    listServiceAreasMock.mockResolvedValueOnce([
      {
        tile: { id: "tile-1", slug: "alpha", name: "Alpha", status: "LIVE" },
        zipCount: 5,
        coveragePercent: 92,
        coverageRatio: 0.92,
        tileGeometry: null,
      },
    ]);
    listAvailabilityMock.mockResolvedValueOnce([
      {
        profileId: "profile-1",
        userId: "user-1",
        name: "Taylor",
        status: "CERTIFIED",
        availability: [],
      },
    ]);

    const response = await GET(createRequest());
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual({
      ok: true,
      data: {
        tiles: [
          {
            id: "tile-1",
            slug: "alpha",
            name: "Alpha",
            status: "LIVE",
            zipCount: 5,
            coveragePercent: 92,
            coverageRatio: 0.92,
            tileGeometry: null,
          },
        ],
        scoopers: [
          {
            profileId: "profile-1",
            userId: "user-1",
            name: "Taylor",
            status: "CERTIFIED",
            availability: [],
          },
        ],
      },
    });

    expect(listServiceAreasMock).toHaveBeenCalledWith("org_123");
    expect(listAvailabilityMock).toHaveBeenCalledWith("org_123");
    expect(infoMock).toHaveBeenCalledWith("marketplace.availability", {
      orgId: "org_123",
      tiles: 1,
      scoopers: 1,
    });
  });

  it("applies availability changes and logs the delta", async () => {
    prismaMock.serviceTile.findMany.mockResolvedValueOnce([
      { id: "tile-1", slug: "alpha" },
    ]);
    updateAvailabilityMock.mockResolvedValueOnce([
      {
        id: "availability-1",
        tileId: "tile-1",
        tileSlug: "alpha",
        tileName: "Alpha",
        weekday: 1,
        window: AvailabilityWindow.FULL,
        maxStops: 5,
      },
    ]);

    const request = createRequest({
      scooperId: "profile-1",
      add: [
        {
          tileSlug: "alpha",
          weekday: 1,
          window: AvailabilityWindow.FULL,
          maxStops: 5,
        },
      ],
      remove: ["availability-old"],
    });

    const response = await PATCH(request as any);
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      data: [
        {
          id: "availability-1",
          tileId: "tile-1",
          tileSlug: "alpha",
          tileName: "Alpha",
          weekday: 1,
          window: AvailabilityWindow.FULL,
          maxStops: 5,
        },
      ],
    });

    expect(updateAvailabilityMock).toHaveBeenCalledWith("org_123", "profile-1", {
      removeIds: ["availability-old"],
      add: [
        {
          tileId: "tile-1",
          weekday: 1,
          window: AvailabilityWindow.FULL,
          maxStops: 5,
        },
      ],
    });

    expect(infoMock).toHaveBeenCalledWith("marketplace.availabilityPatch", {
      orgId: "org_123",
      scooperId: "profile-1",
      added: 1,
      removed: 1,
    });
  });

  it("warns and responds with 404 when tiles cannot be resolved", async () => {
    prismaMock.serviceTile.findMany.mockResolvedValueOnce([]);
    getTileBySlugMock.mockResolvedValueOnce(null);

    const response = await PATCH(
      createRequest({
        scooperId: "profile-1",
        add: [
          {
            tileSlug: "missing",
            weekday: 2,
          },
        ],
      }) as any,
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("unknown_tiles");
    expect(warnMock).toHaveBeenCalledWith("marketplace.availabilityPatch", {
      orgId: "org_123",
      scooperId: "profile-1",
      error: "unknown_tiles",
      missing: ["missing"],
    });
  });
});
