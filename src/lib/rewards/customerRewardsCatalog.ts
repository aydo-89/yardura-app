export type CustomerRewardSeedItem = {
  slug: string;
  name: string;
  description: string;
  pointsCost: number;
  category: string;
  imageUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export const DEFAULT_CUSTOMER_REWARDS: CustomerRewardSeedItem[] = [
  {
    slug: "chewy-gift-card-10",
    name: "Chewy gift card - $10",
    description: "Digital Chewy gift card delivered by Dispatch within 48 hours.",
    pointsCost: 150,
    category: "Gift Card",
    metadata: { provider: "chewy", fulfillment: "digital", etaDays: 2, valueCents: 1000 },
  },
  {
    slug: "chewy-gift-card-25",
    name: "Chewy gift card - $25",
    description: "Digital Chewy gift card delivered by Dispatch within 48 hours.",
    pointsCost: 350,
    category: "Gift Card",
    metadata: { provider: "chewy", fulfillment: "digital", etaDays: 2, valueCents: 2500 },
  },
  {
    slug: "amazon-gift-card-10",
    name: "Amazon gift card - $10",
    description: "Digital Amazon gift card delivered by Dispatch within 48 hours.",
    pointsCost: 150,
    category: "Gift Card",
    metadata: { provider: "amazon", fulfillment: "digital", etaDays: 2, valueCents: 1000 },
  },
  {
    slug: "amazon-gift-card-25",
    name: "Amazon gift card - $25",
    description: "Digital Amazon gift card delivered by Dispatch within 48 hours.",
    pointsCost: 350,
    category: "Gift Card",
    metadata: { provider: "amazon", fulfillment: "digital", etaDays: 2, valueCents: 2500 },
  },
  {
    slug: "doordash-gift-card-10",
    name: "DoorDash gift card - $10",
    description: "Digital DoorDash gift card delivered by Dispatch within 48 hours.",
    pointsCost: 150,
    category: "Gift Card",
    metadata: { provider: "doordash", fulfillment: "digital", etaDays: 2, valueCents: 1000 },
  },
  {
    slug: "doordash-gift-card-25",
    name: "DoorDash gift card - $25",
    description: "Digital DoorDash gift card delivered by Dispatch within 48 hours.",
    pointsCost: 350,
    category: "Gift Card",
    metadata: { provider: "doordash", fulfillment: "digital", etaDays: 2, valueCents: 2500 },
  },
];
