import { NextResponse } from "next/server";
import { getBusinessConfig } from "@/lib/business-config";

export async function GET() {
  try {
    // Get the business configuration for pricing
    const businessConfig = await getBusinessConfig("yardura");

    // Extract and transform the base pricing configuration for client-side use
    const basePricing = businessConfig.basePricing;

    // Transform the configuration to a client-friendly format
    const clientConfig = {
      basePricing: {
        // Yard size bases (using tier 1 as base, multiplied by yard size multipliers)
        smallYardBase: Math.round(basePricing.tiers[0]?.basePriceCents * (basePricing.yardSizes.find(y => y.size === 'small')?.multiplier || 0.8) || 2000),
        mediumYardBase: basePricing.tiers[0]?.basePriceCents || 2500,
        largeYardBase: Math.round(basePricing.tiers[0]?.basePriceCents * (basePricing.yardSizes.find(y => y.size === 'large')?.multiplier || 1.2) || 3000),
        extraLargeYardBase: Math.round(basePricing.tiers[0]?.basePriceCents * (basePricing.yardSizes.find(y => y.size === 'xlarge')?.multiplier || 1.4) || 3500),

        // Dog multipliers (calculated from tier pricing)
        dogMultipliers: {
          "1": basePricing.tiers[0]?.basePriceCents && basePricing.tiers[1]?.basePriceCents ? (basePricing.tiers[0].basePriceCents / basePricing.tiers[1].basePriceCents) : 0.8,
          "2": 1.0, // baseline
          "3": basePricing.tiers[1]?.extraDogPriceCents && basePricing.tiers[1]?.basePriceCents ? ((basePricing.tiers[1].basePriceCents + basePricing.tiers[1].extraDogPriceCents) / basePricing.tiers[1].basePriceCents) : 1.12,
          "4": basePricing.tiers[1]?.extraDogPriceCents && basePricing.tiers[1]?.basePriceCents ? ((basePricing.tiers[1].basePriceCents + 2 * basePricing.tiers[1].extraDogPriceCents) / basePricing.tiers[1].basePriceCents) : 1.28,
        },

        // Frequency multipliers
        frequencyMultipliers: Object.fromEntries(
          basePricing.frequencies.map(f => [f.frequency, f.multiplier])
        ),

        // Add-on prices
        addOnPrices: Object.fromEntries(
          basePricing.addOns.map(addon => [addon.id, addon.priceCents])
        ),
      },
    };

    return NextResponse.json(clientConfig);
  } catch (error) {
    console.error("Error fetching pricing config:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing configuration" },
      { status: 500 },
    );
  }
}
