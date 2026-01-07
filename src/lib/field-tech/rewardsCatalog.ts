export type ScooperRewardSeedItem = {
  slug: string;
  name: string;
  description: string;
  pointsCost: number;
  category: string;
  imageUrl?: string | null;
  metadata?: Record<string, unknown>;
};

export const DEFAULT_SCOOPER_REWARDS: ScooperRewardSeedItem[] = [
  {
    slug: "amazon-gift-card-10",
    name: "Amazon gift card - $10",
    description: "Digital Amazon gift card delivered by Dispatch within 48 hours.",
    pointsCost: 2500,
    category: "Gift Card",
    metadata: { provider: "amazon", fulfillment: "digital", etaDays: 2 },
  },
  {
    slug: "amazon-gift-card-25",
    name: "Amazon gift card - $25",
    description: "Digital Amazon gift card delivered by Dispatch within 48 hours.",
    pointsCost: 6000,
    category: "Gift Card",
    metadata: { provider: "amazon", fulfillment: "digital", etaDays: 2 },
  },
  {
    slug: "amazon-gift-card-50",
    name: "Amazon gift card - $50",
    description: "Digital Amazon gift card delivered by Dispatch within 48 hours.",
    pointsCost: 11000,
    category: "Gift Card",
    metadata: { provider: "amazon", fulfillment: "digital", etaDays: 2 },
  },
  {
    slug: "amazon-gift-card-100",
    name: "Amazon gift card - $100",
    description: "Digital Amazon gift card delivered by Dispatch within 48 hours.",
    pointsCost: 21000,
    category: "Gift Card",
    metadata: { provider: "amazon", fulfillment: "digital", etaDays: 2 },
  },
];
