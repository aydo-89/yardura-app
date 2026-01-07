import { describe, expect, it } from "vitest";

import { buildTileMessaging } from "@/lib/marketplace";
import type { ZipEligibilityResult } from "@/lib/zip-eligibility";

const baseEligibility = (overrides: Partial<ZipEligibilityResult> = {}): ZipEligibilityResult => ({
  eligible: true,
  message: "Service available",
  estimatedDelivery: "Within 2-3 days",
  tile: null,
  zone: undefined,
  ...overrides,
});

describe("buildTileMessaging", () => {
  it("returns live copy with estimated delivery", () => {
    const result = buildTileMessaging(
      baseEligibility({
        tile: {
          slug: "minneapolis-central",
          status: "LIVE",
          activationEligible: true,
          advisoryReasons: [],
          goLiveDate: null,
        },
      }),
    );

    expect(result.headline).toContain("We're live");
    expect(result.detail).toContain("Within 2-3 days");
  });

  it("returns waitlist copy when activationEligible is false", () => {
    const result = buildTileMessaging(
      baseEligibility({
        tile: {
          slug: "edina-north",
          status: "WAITLIST",
          activationEligible: false,
          advisoryReasons: ["Need five more neighbors"],
          goLiveDate: null,
        },
      }),
    );

    expect(result.headline).toContain("activating routes");
    expect(result.detail).toContain("minimum density");
    expect(result.advisories).toEqual(["Need five more neighbors"]);
  });

  it("returns out-of-area waitlist copy when not eligible", () => {
    const result = buildTileMessaging(
      baseEligibility({
        eligible: false,
        tile: {
          slug: "edina-north",
          status: "WAITLIST",
          activationEligible: true,
          advisoryReasons: ["Launching Q3"],
          goLiveDate: null,
        },
      }),
    );

    expect(result.headline).toContain("expansion radar");
    expect(result.detail).toContain("Launching Q3");
  });

  it("falls back to generic messaging when tile is absent", () => {
    const result = buildTileMessaging(baseEligibility());

    expect(result.headline).toContain("Service available");
    expect(result.detail).toBe("Within 2-3 days");
  });
});
