import { NextRequest, NextResponse } from "next/server";
import { stripe, getStripePriceId, BILLING_ANCHOR_DAYS } from "@/lib/stripe";
import { db } from "@/lib/database";
import {
  calcPerVisitEstimate,
  calcOneTimeEstimate,
  type Frequency,
  type YardSize,
} from "@/lib/pricing";

export async function POST(request: NextRequest) {
  try {
    const { customerId, paymentMethodId, serviceDetails, serviceDay } =
      await request.json();

    const {
      name,
      email,
      phone,
      address,
      city,
      zip,
      dogs,
      yardSize,
      frequency,
      deodorize,
      litter,
      dataOptIn,
    } = serviceDetails;

    // Validate required fields
    if (!customerId || !paymentMethodId || !serviceDay) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Calculate the per-visit price
    const perVisitPrice =
      frequency === "one-time"
        ? calcOneTimeEstimate(dogs, yardSize as YardSize, { deodorize })
        : calcPerVisitEstimate(
            dogs,
            frequency as Frequency,
            yardSize as YardSize,
            {
              deodorize,
              litter,
            },
          );

    // Get the appropriate Stripe price ID
    const stripePriceId = await getStripePriceId(
      frequency as Frequency,
      yardSize as YardSize,
      dogs,
    );

    let subscriptionId: string | null = null;

    if (frequency === "one-time") {
      // For one-time service, charge immediately after completion using charge-service route.
      // Here we simply store the customer and visit; no subscription is created now.
    } else {
      // Create subscription with deferred billing
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: stripePriceId }],
        default_payment_method: paymentMethodId,
        billing_cycle_anchor:
          BILLING_ANCHOR_DAYS[serviceDay as keyof typeof BILLING_ANCHOR_DAYS],
        collection_method: "send_invoice",
        days_until_due: 1,
        metadata: {
          service_type: "yardura_dog_waste_removal",
          frequency,
          yard_size: yardSize,
          dogs: dogs.toString(),
          service_day: serviceDay,
          deodorize: deodorize.toString(),
          litter: litter.toString(),
        },
      });
      subscriptionId = subscription.id;
    }

    // Create customer record in our database
    const customer = await db.createCustomer({
      stripeCustomerId: customerId,
      email,
      name,
      phone,
      address,
      city,
      zip,
      serviceDay,
      frequency: frequency as Frequency,
      yardSize: yardSize as YardSize,
      dogs,
      addOns: { deodorize, litter },
      dataOptIn,
      stripePriceId,
      status: "pending", // Will be activated after first service completion
    });

    // Schedule first service visit
    const firstVisitDate = calculateNextServiceDate(serviceDay);
    await db.createServiceVisit({
      customerId: customer.id,
      scheduledDate: firstVisitDate,
      status: "scheduled",
      amount: perVisitPrice,
    });

    return NextResponse.json({
      subscriptionId,
      oneTime: frequency === "one-time",
      customerId: customer.id,
      nextServiceDate: firstVisitDate,
    });
  } catch (error) {
    console.error("Subscription creation error:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 },
    );
  }
}

// Helper function to calculate next service date
function calculateNextServiceDate(serviceDay: string): Date {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const targetDayIndex = days.indexOf(serviceDay.toLowerCase());

  const today = new Date();
  const currentDayIndex = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

  let daysUntilTarget = targetDayIndex - currentDayIndex;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Next week
  }

  const nextServiceDate = new Date(today);
  nextServiceDate.setDate(today.getDate() + daysUntilTarget);
  nextServiceDate.setHours(9, 0, 0, 0); // 9 AM

  return nextServiceDate;
}
