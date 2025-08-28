-- Stripe Products and Prices Setup for Yardura
-- This creates all the necessary products and prices in Stripe
-- Run these commands in your Stripe Dashboard or via API

-- ==========================================
-- 1. CREATE PRODUCTS
-- ==========================================

-- Weekly Service Product
-- curl -X POST https://api.stripe.com/v1/products \
--   -u sk_live_your_secret_key_here: \
--   -d name="Yardura Weekly Dog Waste Removal Service" \
--   -d id="prod_weekly_service" \
--   -d description="Professional weekly dog waste removal service"

-- Bi-Weekly Service Product
-- curl -X POST https://api.stripe.com/v1/products \
--   -u sk_live_your_secret_key_here: \
--   -d name="Yardura Bi-Weekly Dog Waste Removal Service" \
--   -d id="prod_bi_weekly_service" \
--   -d description="Professional bi-weekly dog waste removal service"

-- Twice Weekly Service Product
-- curl -X POST https://api.stripe.com/v1/products \
--   -u sk_live_your_secret_key_here: \
--   -d name="Yardura Twice Weekly Dog Waste Removal Service" \
--   -d id="prod_twice_weekly_service" \
--   -d description="Professional twice weekly dog waste removal service"

-- One-Time Service Product
-- curl -X POST https://api.stripe.com/v1/products \
--   -u sk_live_your_secret_key_here: \
--   -d name="Yardura One-Time Dog Waste Removal Service" \
--   -d id="prod_one_time_service" \
--   -d description="Professional one-time dog waste removal service"

-- ==========================================
-- 2. CREATE PRICES - WEEKLY SERVICE
-- ==========================================

-- Weekly - Small Yard (20% discount from medium)
-- 1 Dog: $20 × 0.8 = $16/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=1600 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=small \
--   -d metadata[dogs]=1 \
--   -d id="price_weekly_small_1dog"

-- 2 Dogs: $24 × 0.8 = $19.20/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=1920 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=small \
--   -d metadata[dogs]=2 \
--   -d id="price_weekly_small_2dog"

-- 3+ Dogs: $28 × 0.8 = $22.40/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=2240 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=small \
--   -d metadata[dogs]=3 \
--   -d id="price_weekly_small_3dog"

-- Weekly - Medium Yard (base price)
-- 1 Dog: $20/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=2000 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=medium \
--   -d metadata[dogs]=1 \
--   -d id="price_weekly_medium_1dog"

-- 2 Dogs: $24/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=2400 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=medium \
--   -d metadata[dogs]=2 \
--   -d id="price_weekly_medium_2dog"

-- 3+ Dogs: $28/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=2800 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=medium \
--   -d metadata[dogs]=3 \
--   -d id="price_weekly_medium_3dog"

-- Weekly - Large Yard (20% premium)
-- 1 Dog: $20 × 1.2 = $24/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=2400 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=large \
--   -d metadata[dogs]=1 \
--   -d id="price_weekly_large_1dog"

-- 2 Dogs: $24 × 1.2 = $28.80/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=2880 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=large \
--   -d metadata[dogs]=2 \
--   -d id="price_weekly_large_2dog"

-- 3+ Dogs: $28 × 1.2 = $33.60/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=3360 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=large \
--   -d metadata[dogs]=3 \
--   -d id="price_weekly_large_3dog"

-- Weekly - X-Large Yard (40% premium)
-- 1 Dog: $20 × 1.4 = $28/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=2800 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=xlarge \
--   -d metadata[dogs]=1 \
--   -d id="price_weekly_xlarge_1dog"

-- 2 Dogs: $24 × 1.4 = $33.60/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=3360 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=xlarge \
--   -d metadata[dogs]=2 \
--   -d id="price_weekly_xlarge_2dog"

-- 3+ Dogs: $28 × 1.4 = $39.20/week
-- curl -X POST https://api.stripe.com/v1/prices \
--   -u sk_live_your_secret_key_here: \
--   -d product="prod_weekly_service" \
--   -d unit_amount=3920 \
--   -d currency=usd \
--   -d recurring[interval]=week \
--   -d metadata[yard_size]=xlarge \
--   -d metadata[dogs]=3 \
--   -d id="price_weekly_xlarge_3dog"

-- ==========================================
-- 3. CREATE PRICES - BI-WEEKLY SERVICE
-- ==========================================

-- Bi-Weekly follows the same pattern but with bi-weekly interval
-- and prices are per visit (so customer pays $28 per visit, every 2 weeks)

-- ==========================================
-- 4. CREATE PRICES - TWICE WEEKLY SERVICE
-- ==========================================

-- Twice Weekly: $32 base per week (for 2 visits)
-- Per visit calculation: $32 ÷ 2 = $16 per visit

-- ==========================================
-- 5. CREATE PRICES - ONE-TIME SERVICE
-- ==========================================

-- One-Time: No recurring, just one-time payment
-- Same yard size multipliers as above
-- 1 Dog: $89 base
-- 2 Dogs: $104 base
-- 3+ Dogs: $119 base

-- ==========================================
-- HOW TO USE THIS:
-- ==========================================
--
-- 1. Replace "sk_live_your_secret_key_here" with your actual Stripe secret key
-- 2. Copy each curl command and run it in your terminal
-- 3. Or use the Stripe Dashboard to create products manually
-- 4. Update src/lib/stripe.ts with the actual price IDs you create
--
-- Note: All prices are in cents (so $20 = 2000 cents)
-- The metadata helps you track which price is for which configuration
