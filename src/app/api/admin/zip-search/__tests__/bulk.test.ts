import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NextRequest } from "next/server";

import { POST } from "@/app/api/admin/zip-search/bulk/route";

const checkZipEligibilityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/zip-eligibility", () => ({
  checkZipEligibility: checkZipEligibilityMock,
}));

const createRequest = (body?: unknown) =>
  ({
    json: async () => body,
  }) as unknown as NextRequest;

describe("/api/admin/zip-search/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregated eligibility results for each ZIP", async () => {
    checkZipEligibilityMock.mockImplementation(async (zip: string) => ({
      eligible: zip !== "99999",
      zone: { name: "Urban", zoneId: "urban" },
      message: "ok",
      tile: {
        slug: "minneapolis-core",
        status: "LIVE",
        activationEligible: true,
        advisoryReasons: [],
        goLiveDate: null,
      },
    }));

    const response = await POST(
      createRequest({
        zipCodes: ["55419", "99999"],
        businessId: "yardura",
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();

    expect(json).toEqual({
      businessId: "yardura",
      count: 2,
      results: [
        {
          zipCode: "55419",
          result: expect.objectContaining({ eligible: true }),
        },
        {
          zipCode: "99999",
          result: expect.objectContaining({ eligible: false }),
        },
      ],
    });

    expect(checkZipEligibilityMock).toHaveBeenCalledTimes(2);
    expect(checkZipEligibilityMock).toHaveBeenCalledWith("55419", "yardura");
  });

  it("handles invalid payloads", async () => {
    const response = await POST(createRequest({ zipCodes: [] }));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ error: "zipCodes array is required" });
    expect(checkZipEligibilityMock).not.toHaveBeenCalled();
  });
});
