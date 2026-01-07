import { describe, it, expect, vi } from "vitest";
import {
  calculateInitialClean,
  mapDateToBucket,
  formatInitialCleanPrice,
  getBucketLabel,
  isValidBucket,
  getDefaultConfig,
  type CleanupBucket,
} from "../initialCleanEstimator";

// Mock the business-config module to return predictable test data
vi.mock("../business-config", () => ({
  getBusinessConfig: vi.fn().mockResolvedValue({
    basePricing: {
      tiers: [
        { dogCount: 1, basePriceCents: 1800 },
        { dogCount: 2, basePriceCents: 2200 },
        { dogCount: 3, basePriceCents: 2600 },
        { dogCount: 4, basePriceCents: 3000 },
      ],
      yardSizes: [
        { size: "small", multiplier: 0.9, enabled: true },
        { size: "medium", multiplier: 1.0, enabled: true },
        { size: "large", multiplier: 1.05, enabled: true },
        { size: "xl", multiplier: 1.1, enabled: true },
      ],
      initialClean: {
        enabled: true,
        multiplier: 1.0,
        floorPriceCents: 4900,
        useDaysSinceLastClean: false,
        buckets: [
          { bucket: "7", multiplier: 1.0, floorPriceCents: 4900, label: "≤ 7 days" },
          { bucket: "14", multiplier: 1.0, floorPriceCents: 4900, label: "≤ 2 weeks" },
          { bucket: "42", multiplier: 1.75, floorPriceCents: 6900, label: "2-6 weeks" },
          { bucket: "999", multiplier: 2.5, floorPriceCents: 8900, label: "> 6 weeks" },
        ],
      },
    },
  }),
}));

describe("Initial Clean Estimator", () => {
  const config = getDefaultConfig();

  describe("calculateInitialClean", () => {
    it("should calculate initial clean for well maintained yard (7 days)", async () => {
      const result = await calculateInitialClean(
        2000,
        "7",
        1,
        "medium",
        {},
        "yardura",
      );

      // 2000 * 2.7222 * 1.0 = 5444 (above floor of 4900)
      expect(result.initialCleanCents).toBe(5444);
      expect(result.bucket).toBe("7");
      expect(result.breakdown.bucketMultiplier).toBe(1.0);
    });

    it("should calculate initial clean for moderate accumulation (42 days)", async () => {
      const result = await calculateInitialClean(
        2000,
        "42",
        1,
        "medium",
        {},
        "yardura",
      );

      // 2000 * 2.7222 * 1.75 = 9528 (above floor of 6900)
      expect(result.initialCleanCents).toBeGreaterThanOrEqual(6900);
      expect(result.breakdown.bucketMultiplier).toBe(1.75);
    });

    it("should calculate initial clean for maximum backlog bucket (999 days)", async () => {
      const result = await calculateInitialClean(
        2000,
        "999",
        1,
        "medium",
        {},
        "yardura",
      );

      // 2000 * 2.7222 * 2.5 = 13611 (above floor of 8900)
      expect(result.initialCleanCents).toBeGreaterThanOrEqual(8900);
      expect(result.breakdown.bucketMultiplier).toBe(2.5);
    });

    it("should respect floor prices for low per-visit costs", async () => {
      const result = await calculateInitialClean(
        1000,
        "42",
        1,
        "small",
        {},
        "yardura",
      );

      // 1000 * 2.7222 * 1.75 = 4764, but floor is 6900
      expect(result.initialCleanCents).toBe(6900);
    });

    it("should add cost for multiple areas", async () => {
      const resultOneArea = await calculateInitialClean(
        2000,
        "7",
        1,
        "medium",
        { frontYard: true },
        "yardura",
      );

      const resultTwoAreas = await calculateInitialClean(
        2000,
        "7",
        1,
        "medium",
        { frontYard: true, backYard: true },
        "yardura",
      );

      // Should add $5 (500 cents) per additional area
      expect(resultTwoAreas.initialCleanCents).toBe(
        resultOneArea.initialCleanCents + 500
      );
    });

    it("should handle zone multipliers", async () => {
      const baseResult = await calculateInitialClean(
        2000,
        "7",
        1,
        "medium",
        {},
        "yardura",
        1.0,
      );

      const zonedResult = await calculateInitialClean(
        2000,
        "7",
        1,
        "medium",
        {},
        "yardura",
        1.2, // 20% zone surcharge
      );

      expect(zonedResult.initialCleanCents).toBeGreaterThan(
        baseResult.initialCleanCents
      );
    });
  });

  describe("mapDateToBucket", () => {
    it("should map recent dates to well maintained bucket", () => {
      const today = new Date();
      const result = mapDateToBucket(today);
      expect(result).toBe("14");
    });

    it("should map 2-week old dates to light accumulation", () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const result = mapDateToBucket(twoWeeksAgo);
      expect(result).toBe("14");
    });

    it("should map month-old dates to moderate accumulation", () => {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const result = mapDateToBucket(monthAgo);
      expect(result).toBe("42");
    });

    it("should map old dates to maximum backlog", () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 100);
      const result = mapDateToBucket(longAgo);
      expect(result).toBe("999");
    });
  });

  describe("formatInitialCleanPrice", () => {
    it("should format zero as Free", () => {
      expect(formatInitialCleanPrice(0)).toBe("Free");
    });

    it("should format cents to dollars with two decimal places", () => {
      expect(formatInitialCleanPrice(4900)).toBe("$49.00");
      expect(formatInitialCleanPrice(6900)).toBe("$69.00");
      expect(formatInitialCleanPrice(8900)).toBe("$89.00");
    });
  });

  describe("getBucketLabel", () => {
    it("should return correct labels for each bucket", () => {
      expect(getBucketLabel("7", config)).toContain("7 days");
      expect(getBucketLabel("14", config)).toContain("2 weeks");
      expect(getBucketLabel("42", config)).toBeDefined();
      expect(getBucketLabel("999", config)).toContain("6 weeks");
    });
  });

  describe("isValidBucket", () => {
    it("should validate correct bucket values", () => {
      expect(isValidBucket("7")).toBe(true);
      expect(isValidBucket("14")).toBe(true);
      expect(isValidBucket("42")).toBe(true);
      expect(isValidBucket("999")).toBe(true);
    });

    it("should reject invalid bucket values", () => {
      expect(isValidBucket("invalid")).toBe(false);
      expect(isValidBucket("")).toBe(false);
      expect(isValidBucket("0")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle minimum values", async () => {
      const result = await calculateInitialClean(
        1000,
        "7",
        1,
        "small",
        {},
        "yardura",
      );

      expect(result.initialCleanCents).toBeGreaterThanOrEqual(4900);
    });

    it("should handle maximum backlog with multiple dogs and large yard", async () => {
      const result = await calculateInitialClean(
        3000,
        "999",
        4,
        "xl",
        {},
        "yardura",
      );

      expect(result.initialCleanCents).toBeGreaterThanOrEqual(8900);
      expect(result.breakdown.bucketMultiplier).toBe(2.5);
    });

    it("should handle leap year dates correctly", async () => {
      const leapDay = new Date("2024-02-29T12:00:00.000Z");
      const bucket = mapDateToBucket(leapDay);
      expect(bucket).toBeDefined();
      expect(["7", "14", "42", "999"]).toContain(bucket);
    });
  });
});
