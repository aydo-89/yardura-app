# Stripe Setup Guide for Yardura Dog Waste Removal Service

This guide will walk you through setting up Stripe for your dog waste removal business with the following features:
- ✅ Payment method collection during signup
- ✅ Deferred billing (charge only after service completion)
- ✅ Flexible service frequencies (weekly, bi-weekly, twice-weekly)
- ✅ Service day selection
- ✅ Cancellation and rescheduling support
- ✅ Automatic next service scheduling

## 🔧 Step 1: Stripe Account Setup

### 1.1 Create Stripe Account
1. Go to [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Complete business verification
3. Enable test mode for development

### 1.2 Get API Keys
1. In Stripe Dashboard, go to **Developers → API Keys**
2. Copy your:
   - **Publishable Key** (starts with `pk_test_`)
   - **Secret Key** (starts with `sk_test_`)

### 1.3 Create Webhook Endpoint
1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click **"Add endpoint"**
3. Set URL: `https://yourdomain.com/api/stripe/webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Webhook Signing Secret** (starts with `whsec_`)

## 📦 Step 2: Create Products and Prices

You'll need to create products and prices for all combinations of:
- Service frequency: weekly, bi-weekly, twice-weekly, one-time
- Yard size: small, medium, large, xlarge
- Number of dogs: 1, 2, 3+

### 2.1 Create Products
In Stripe Dashboard → **Products**:

**Weekly Service Product:**
- Name: "Weekly Dog Waste Removal Service"
- ID: `prod_weekly_service`
- Type: Service

**Bi-Weekly Service Product:**
- Name: "Bi-Weekly Dog Waste Removal Service"
- ID: `prod_bi_weekly_service`
- Type: Service

**Twice Weekly Service Product:**
- Name: "Twice Weekly Dog Waste Removal Service"
- ID: `prod_twice_weekly_service`
- Type: Service

**One-Time Service Product:**
- Name: "One-Time Dog Waste Removal Service"
- ID: `prod_one_time_service`
- Type: Service

### 2.2 Create Prices
For each product, create prices following this pattern:

**Weekly Service Prices:**
```
Small yard, 1 dog: $20/week → ID: price_weekly_small_1dog
Small yard, 2 dogs: $24/week → ID: price_weekly_small_2dog
Small yard, 3+ dogs: $28/week → ID: price_weekly_small_3dog
Medium yard, 1 dog: $20/week → ID: price_weekly_medium_1dog
Medium yard, 2 dogs: $24/week → ID: price_weekly_medium_2dog
Medium yard, 3+ dogs: $28/week → ID: price_weekly_medium_3dog
Large yard, 1 dog: $24/week → ID: price_weekly_large_1dog
Large yard, 2 dogs: $28/week → ID: price_weekly_large_2dog
Large yard, 3+ dogs: $32/week → ID: price_weekly_large_3dog
X-Large yard, 1 dog: $28/week → ID: price_weekly_xlarge_1dog
X-Large yard, 2 dogs: $32/week → ID: price_weekly_xlarge_2dog
X-Large yard, 3+ dogs: $36/week → ID: price_weekly_xlarge_3dog
```

**Repeat for bi-weekly, twice-weekly, and one-time services** using your pricing from `src/lib/pricing.ts`.

## 🔐 Step 3: Environment Variables

Create a `.env.local` file in your project root:

```env
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here

# Database (replace with your actual database URL)
DATABASE_URL=your_database_connection_string
```

## 🗄️ Step 4: Database Setup

### 4.1 Install Prisma (if not already installed)
```bash
npm install prisma @prisma/client
npx prisma init
```

### 4.2 Update `prisma/schema.prisma`
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model YarduraCustomer {
  id                  String   @id @default(cuid())
  stripeCustomerId    String   @unique
  email               String
  name                String
  phone               String?
  address             String?
  city                String?
  zip                 String?
  serviceDay          String   // 'monday', 'tuesday', etc.
  frequency           String   // 'weekly', 'twice-weekly', 'bi-weekly', 'one-time'
  yardSize            String   // 'small', 'medium', 'large', 'xlarge'
  dogs                Int
  addOns              Json     // { deodorize: boolean, litter: boolean }
  dataOptIn           Boolean
  stripeSubscriptionId String? @unique
  stripePriceId       String
  status              String   // 'pending', 'active', 'paused', 'cancelled'
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  serviceVisits       ServiceVisit[]
}

model ServiceVisit {
  id                     String   @id @default(cuid())
  customerId             String
  scheduledDate          DateTime
  completedDate          DateTime?
  status                 String   // 'scheduled', 'completed', 'cancelled', 'rescheduled'
  amount                 Float
  stripePaymentIntentId  String?  @unique
  notes                  String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  customer               YarduraCustomer @relation(fields: [customerId], references: [id], onDelete: Cascade)
}
```

### 4.3 Run Migrations
```bash
npx prisma migrate dev --name init
npx prisma generate
```

## 🎛️ Step 5: Update Price IDs in Code

Update `src/lib/stripe.ts` with your actual Stripe price IDs:

```typescript
// Replace the placeholder IDs with your actual Stripe price IDs
export const STRIPE_PRODUCTS = {
  weekly: {
    id: 'prod_weekly_service',
    prices: {
      small: {
        1: 'price_weekly_small_1dog',     // Your actual price ID
        2: 'price_weekly_small_2dog',     // Your actual price ID
        3: 'price_weekly_small_3dog',     // Your actual price ID
      },
      // ... continue for all combinations
    }
  },
  // ... continue for other frequencies
};
```

## 🔧 Step 6: Install Required Dependencies

```bash
npm install stripe @stripe/react-stripe-js @stripe/stripe-js
```

## 🌐 Step 7: Update Quote Form Integration

The code already includes a Stripe payment form component. You'll need to integrate it into your quote form by:

1. Importing the Stripe component
2. Collecting payment method before creating the subscription
3. Passing the payment method ID to the subscription creation API

## 📋 Step 8: Business Operations Workflow

### Customer Signup Process:
1. Customer fills out quote form
2. System calculates pricing based on dogs, yard size, frequency
3. Stripe Elements collects and saves payment method (no immediate charge)
4. Subscription is created with `collection_method: 'send_invoice'`
5. First service visit is scheduled

### Service Completion Process:
1. After completing service, mark visit as complete via dashboard
2. System triggers payment using saved payment method
3. Customer is charged for that specific visit
4. Next service visit is automatically scheduled

### Cancellation/Rescheduling:
1. Customer requests cancellation or reschedule
2. System updates service visit status
3. No charge for cancelled visits
4. Rescheduled visits maintain original pricing

## 🧪 Step 9: Testing

### Test the Integration:
1. Use Stripe test cards (e.g., `4242424242424242`)
2. Test subscription creation
3. Test service completion charging
4. Test cancellation/rescheduling
5. Verify webhooks are working

## 🚀 Step 10: Go Live

### Production Setup:
1. Switch to live Stripe keys
2. Update webhook URL to production domain
3. Create live products and prices
4. Test with real cards (small amounts first)
5. Monitor Stripe dashboard for transactions

## 📞 Support and Next Steps

Once you've completed the setup, you'll have:
- ✅ Secure payment collection during signup
- ✅ Deferred billing system
- ✅ Flexible service scheduling
- ✅ Automatic service tracking
- ✅ Customer management dashboard
- ✅ Webhook integration for real-time updates

## 🔍 Need Help?

If you encounter any issues:
1. Check Stripe Dashboard logs
2. Verify webhook endpoints are active
3. Ensure all price IDs are correct
4. Test with Stripe's test mode first

The system is designed to be flexible and handle your unique business requirements for dog waste removal services with post-service billing.

Would you like me to help you with any specific part of this setup or create additional features like a service management dashboard?
