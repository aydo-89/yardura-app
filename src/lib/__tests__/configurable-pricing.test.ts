import { describe, expect, test } from "vitest";
import { ensureRequiredAddOns } from "../configurable-pricing";
import type { BusinessConfig, AddOnConfig } from "../business-config";

const baseConfig: BusinessConfig = {
  businessId: "test",
  businessName: "Test Org",
  serviceZones: [],
  basePricing: {
    tiers: [],
    frequencies: [],
    yardSizes: [],
    areaPricing: {
      baseAreas: 1,
      extraAreaCostCents: 0,
      recurringExtraAreaCostCents: 0,
      enabled: false,
    },
    initialClean: {
      enabled: false,
      multiplier: 1,
      floorPriceCents: 0,
      useDaysSinceLastClean: false,
      buckets: [],
    },
    addOns: [],
  },
  settings: {
    defaultZoneMultiplier: 1,
    minimumServiceFeeCents: 0,
    rushFeeCents: 0,
    commercialPricingMultiplier: 1,
    weekendSurchargeCents: 0,
  },
  operations: {
    maxServiceRadiusMiles: 0,
    minimumAdvanceBookingHours: 0,
    maximumDogsPerVisit: 0,
    requiresPhotoVerification: false,
    allowsSameDayService: false,
  },
  communication: {
    welcomeEmailEnabled: false,
    smsNotificationsEnabled: false,
    portalAccessEnabled: false,
    marketingEmailsEnabled: false,
  },
};

const getAddon = (addons: AddOnConfig[], id: string) =>
  addons.find((addon) => addon.id === id);

describe("ensureRequiredAddOns", () => {
  test("adds fallback divert add-ons when missing", () => {
    const patched = ensureRequiredAddOns(baseConfig);
    const takeaway = getAddon(patched.basePricing.addOns, "divert-takeaway");
    const compost = getAddon(patched.basePricing.addOns, "divert-compost");

    expect(takeaway?.priceCents).toBe(500);
    expect(compost?.priceCents).toBe(1000);
    expect(takeaway?.available).toBe(true);
    expect(compost?.available).toBe(true);
  });

  test("does not overwrite existing divert pricing", () => {
    const configWithCustom = {
      ...baseConfig,
      basePricing: {
        ...baseConfig.basePricing,
        addOns: [
          {
            id: "divert-compost",
            name: "Custom Compost",
            priceCents: 1500,
            description: "Custom",
            available: true,
            billingMode: "each-visit",
            required: false,
          },
        ],
      },
    } satisfies BusinessConfig;

    const patched = ensureRequiredAddOns(configWithCustom);
    const compost = getAddon(patched.basePricing.addOns, "divert-compost");
    const takeaway = getAddon(patched.basePricing.addOns, "divert-takeaway");

    expect(compost?.priceCents).toBe(1500);
    expect(takeaway?.priceCents).toBe(500);
  });

  test("fills in fallback price when compost routing is present but zeroed out", () => {
    const configWithZeroed = {
      ...baseConfig,
      basePricing: {
        ...baseConfig.basePricing,
        addOns: [
          {
            id: "divert-compost",
            name: "Compost Routing",
            priceCents: 0,
            description: "Custom but missing price",
            available: true,
            billingMode: "each-visit",
            required: false,
          },
        ],
      },
    } satisfies BusinessConfig;

    const patched = ensureRequiredAddOns(configWithZeroed);
    const compost = getAddon(patched.basePricing.addOns, "divert-compost");

    expect(compost?.priceCents).toBe(1000);
    expect(compost?.available).toBe(true);
    expect(compost?.billingMode).toBe("each-visit");
  });
});
