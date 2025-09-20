import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { calculatePricingWithConfig } from "@/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

export async function POST(request: NextRequest) {
  try {
    const { leadId } = await request.json();

    if (!leadId) {
      return NextResponse.json(
        { error: "Lead ID is required" },
        { status: 400 },
      );
    }

    // Fetch lead data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        serviceType: true,
        dogs: true,
        yardSize: true,
        frequency: true,
        address: true,
        city: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        deodorize: true,
        deodorizeMode: true,
        sprayDeck: true,
        sprayDeckMode: true,
        divertMode: true,
        areasToClean: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // Calculate pricing
    const addOns = {
      deodorize: lead.deodorize || false,
      litter: false, // Not implemented in current schema
    };

    const pricing = await calculatePricingWithConfig(
      lead.dogs || 1,
      lead.frequency as "weekly" | "bi-weekly" | "twice-weekly" | "one-time",
      lead.yardSize as "small" | "medium" | "large" | "xlarge",
      addOns,
    );

    // Create Stripe customer if they don't exist
    let customer;
    const existingCustomer = await prisma.user.findFirst({
      where: { email: lead.email },
      select: { stripeCustomerId: true },
    });

    if (existingCustomer?.stripeCustomerId) {
      customer = await stripe.customers.retrieve(
        existingCustomer.stripeCustomerId,
      );
    } else {
      customer = await stripe.customers.create({
        email: lead.email,
        name: `${lead.firstName} ${lead.lastName || ""}`.trim(),
        address: {
          line1: lead.address || "",
          city: lead.city || "",
          postal_code: lead.zipCode || "",
          country: "US",
        },
        metadata: {
          leadId: lead.id,
          serviceType: lead.serviceType || "residential",
        },
      });
    }

    // Create SetupIntent for payment method collection
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ["card"],
      metadata: {
        leadId: lead.id,
        serviceType: lead.serviceType || "residential",
        frequency: lead.frequency || "weekly",
      },
    });

    // Calculate first visit amount (includes one-time charges)
    const firstVisitAmount = pricing.oneTimeCents + pricing.perVisitCents;

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      pricing: {
        perVisit: pricing.perVisitCents,
        monthly: pricing.monthlyCents,
        firstVisit: firstVisitAmount,
        breakdown: pricing.breakdown,
      },
      customerId: customer.id,
    });
  } catch (error) {
    console.error("SetupIntent creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment setup" },
      { status: 500 },
    );
  }
}
