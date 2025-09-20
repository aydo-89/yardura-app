#!/usr/bin/env node

/**
 * Stripe Pricing Setup Script for Yardura (Live Mode)
 * - Loads STRIPE_SECRET_KEY from .env.local automatically
 * - Creates products for each frequency
 * - Creates prices for every combination (frequency × yard size × 1..8 dogs)
 * - Uses lookup_key metadata to map prices to your quote logic
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY not set. Add it to .env.local');
  process.exit(1);
}
const stripe = new Stripe(stripeSecretKey);

const LIVE = stripeSecretKey.startsWith('sk_live_');
console.log(`🔑 Using ${LIVE ? 'LIVE' : 'TEST'} mode`);

// Pricing logic (must match src/lib/pricing.ts)
const YARD_MULTIPLIERS = { small: 0.8, medium: 1.0, large: 1.2, xlarge: 1.4 };
const BASE_RATES = {
  weekly: { base1: 20, base2: 24, base3: 28, extraDog: 4 },
  'twice-weekly': { base1: 32, base2: 38, base3: 44, extraDog: 6 },
  'bi-weekly': { base1: 28, base2: 32, base3: 36, extraDog: 4 },
  'one-time': { base1: 89, base2: 104, base3: 119, extraDog: 15 },
};

function pricePerVisit(frequency, dogs, yardSize) {
  const r = BASE_RATES[frequency];
  let tier = dogs === 1 ? r.base1 : dogs === 2 ? r.base2 : r.base3 + (dogs - 3) * r.extraDog;
  tier *= YARD_MULTIPLIERS[yardSize];
  if (frequency === 'twice-weekly') tier = tier; // weekly total; subscription stays weekly
  return Math.round(tier * 100) / 100;
}

const FREQUENCIES = ['weekly', 'twice-weekly', 'bi-weekly', 'one-time'];
const YARD_SIZES = ['small', 'medium', 'large', 'xlarge'];
const DOG_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];

const PRODUCT_BY_FREQ = {
  weekly: 'Yardura Weekly Dog Waste Removal Service',
  'twice-weekly': 'Yardura Twice Weekly Dog Waste Removal Service',
  'bi-weekly': 'Yardura Bi-Weekly Dog Waste Removal Service',
  'one-time': 'Yardura One-Time Dog Waste Removal Service',
};

async function getOrCreateProduct(frequency) {
  const name = PRODUCT_BY_FREQ[frequency];
  const list = await stripe.products.list({ limit: 100, active: true });
  const existing = list.data.find((p) => p.name === name);
  if (existing) return existing;
  return await stripe.products.create({ name, description: name });
}

async function getOrCreatePrice(productId, frequency, yardSize, dogs) {
  const lookup_key = `${frequency}_${yardSize}_${dogs}dog`;
  // Check existing by lookup_key
  const existing = await stripe.prices.list({ lookup_keys: [lookup_key], limit: 1 });
  if (existing.data.length) return existing.data[0];

  const unit = Math.round(pricePerVisit(frequency, dogs, yardSize) * 100);
  const params = {
    product: productId,
    currency: 'usd',
    unit_amount: unit,
    lookup_key,
    metadata: { frequency, yard_size: yardSize, dogs: String(dogs) },
  };
  if (frequency !== 'one-time') {
    params.recurring = {
      interval: 'week',
      interval_count: frequency === 'bi-weekly' ? 2 : 1,
    };
  }
  return await stripe.prices.create(params);
}

async function main() {
  console.log('🚀 Creating Stripe products and prices...');
  const productMap = {};
  for (const f of FREQUENCIES) {
    const p = await getOrCreateProduct(f);
    productMap[f] = p.id;
    console.log(`📦 Product ready: ${f} → ${p.id}`);
  }

  let created = 0;
  for (const f of FREQUENCIES) {
    for (const y of YARD_SIZES) {
      for (const d of DOG_COUNTS) {
        const price = await getOrCreatePrice(productMap[f], f, y, d);
        created++;
        console.log(
          `💰 ${f}, ${y}, ${d} dog(s) → ${price.id} ($${(price.unit_amount / 100).toFixed(2)})`
        );
      }
    }
  }

  console.log(`\n🎉 Done. Products: ${Object.keys(productMap).length}, Prices: ${created}`);
  console.log('🔎 You can filter by lookup_key like: weekly_medium_2dog');
}

main().catch((err) => {
  console.error('❌ Failed:', err?.message || err);
  process.exit(1);
});
