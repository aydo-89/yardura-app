import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleOfferSweep } from "@/lib/jobs/marketplaceOfferSweeper";

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn() })),
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
  Job: class {},
  JobsOptions: class {},
}));

const expireMock = vi.hoisted(() => vi.fn());
const publishMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  serviceTile: {
    findMany: vi.fn(),
  },
}));
const infoMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/marketplace/offers", () => ({
  expireStaleVisitOffers: expireMock,
}));

vi.mock("@/lib/jobs/marketplaceOfferPublisher", () => ({
  enqueueOfferPublishing: publishMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/log", () => ({
  info: infoMock,
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

describe("handleOfferSweep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips publishing when nothing expires", async () => {
    expireMock.mockResolvedValue({ expiredCount: 0, tileIds: [], serviceVisitIds: [] });

    const result = await handleOfferSweep({ orgId: "org" });

    expect(result).toEqual({ expiredCount: 0, tilesRefreshed: 0 });
    expect(publishMock).not.toHaveBeenCalled();
    expect(infoMock).toHaveBeenCalledWith("marketplace.offerSweeper", expect.any(Object));
  });

  it("uses provided tile slugs when refreshing offers", async () => {
    expireMock.mockResolvedValue({ expiredCount: 3, tileIds: ["tile-1"], serviceVisitIds: [] });

    const result = await handleOfferSweep({ orgId: "org", tileSlugs: ["alpha"] });

    expect(result).toEqual({ expiredCount: 3, tilesRefreshed: 1 });
    expect(prismaMock.serviceTile.findMany).not.toHaveBeenCalled();
    expect(publishMock).toHaveBeenCalledWith({ orgId: "org", tileSlugs: ["alpha"] });
  });

  it("derives tile slugs when none provided", async () => {
    expireMock.mockResolvedValue({ expiredCount: 2, tileIds: ["tile-A", "tile-B"], serviceVisitIds: [] });
    prismaMock.serviceTile.findMany.mockResolvedValue([
      { slug: "alpha" },
      { slug: "beta" },
    ]);

    await handleOfferSweep({ orgId: "org" });

    expect(prismaMock.serviceTile.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["tile-A", "tile-B"] } },
      select: { slug: true },
    });
    expect(publishMock).toHaveBeenCalledWith({ orgId: "org", tileSlugs: ["alpha", "beta"] });
  });
});
