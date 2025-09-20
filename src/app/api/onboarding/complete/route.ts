import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';
import { calculatePricingWithConfig } from '@/lib/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request: NextRequest) {
  try {
    const { leadId, setupIntentId } = await request.json();

    if (!leadId || !setupIntentId) {
      return NextResponse.json(
        { error: 'Lead ID and SetupIntent ID are required' },
        { status: 400 }
      );
    }

    // Retrieve and verify SetupIntent
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    if (setupIntent.status !== 'succeeded') {
      return NextResponse.json(
        { error: 'Payment setup was not completed' },
        { status: 400 }
      );
    }

    // Get lead data
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        serviceType: true,
        dogs: true,
        yardSize: true,
        frequency: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        deodorize: true,
        deodorizeMode: true,
        sprayDeck: true,
        sprayDeckMode: true,
        divertMode: true,
        areasToClean: true,
        submittedAt: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Get or create user
    let user = await prisma.user.findFirst({
      where: { email: lead.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: lead.email,
          name: `${lead.firstName} ${lead.lastName || ''}`.trim(),
          phone: lead.phone,
          address: lead.address,
          city: lead.city,
          zipCode: lead.zipCode,
        },
      });
    }

    // Get or create customer
    let customer = await prisma.customer.findFirst({
      where: { email: lead.email },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          orgId: 'yardura-org', // Default org for now
          name: `${lead.firstName} ${lead.lastName || ''}`.trim(),
          email: lead.email,
          phone: lead.phone,
          addressLine1: lead.address || '',
          city: lead.city || '',
          state: lead.state || '',
          zip: lead.zipCode || '',
          latitude: lead.latitude,
          longitude: lead.longitude,
        },
      });
    }

    // Calculate pricing for subscription
    const addOns = {
      deodorize: lead.deodorize || false,
      litter: false,
    };

    const pricing = await calculatePricingWithConfig(
      lead.dogs || 1,
      lead.frequency as 'weekly' | 'bi-weekly' | 'twice-weekly' | 'one-time',
      lead.yardSize as 'small' | 'medium' | 'large' | 'xlarge',
      addOns
    );

    // Create Stripe product first
    const product = await stripe.products.create({
      name: `Yardura ${lead.serviceType} Service`,
      description: `${lead.frequency} service for ${lead.dogs} dog${lead.dogs !== 1 ? 's' : ''}`,
      metadata: {
        leadId: lead.id,
        customerId: customer.id,
        serviceType: lead.serviceType || 'residential',
        frequency: lead.frequency || 'weekly',
      },
    });

    // Create Stripe price
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: pricing.perVisitCents,
      recurring: {
        interval: lead.frequency === 'monthly' ? 'month' :
                 lead.frequency === 'bi-weekly' ? 'week' :
                 'week',
        interval_count: lead.frequency === 'bi-weekly' ? 2 :
                       lead.frequency === 'twice-weekly' ? 1 : 1,
      },
      product: product.id,
      metadata: {
        leadId: lead.id,
        customerId: customer.id,
        serviceType: lead.serviceType || 'residential',
        frequency: lead.frequency || 'weekly',
      },
    });

    // Create Stripe subscription
    const subscription = await stripe.subscriptions.create({
      customer: setupIntent.customer as string,
      items: [{
        price: price.id,
      }],
      default_payment_method: setupIntent.payment_method as string,
      metadata: {
        leadId: lead.id,
        customerId: customer.id,
        serviceType: lead.serviceType || 'residential',
        frequency: lead.frequency || 'weekly',
      },
    });

    // Create job in database
    const frequencyMap = {
      'weekly': 'WEEKLY' as const,
      'bi-weekly': 'BI_WEEKLY' as const,
      'twice-weekly': 'TWICE_WEEKLY' as const,
      'one-time': 'ONE_TIME' as const,
      'monthly': 'BI_WEEKLY' as const, // Map monthly to bi-weekly as fallback
    };

    const job = await prisma.job.create({
      data: {
        orgId: 'yardura-org',
        customerId: customer.id,
        frequency: frequencyMap[lead.frequency as keyof typeof frequencyMap] || 'WEEKLY',
        dayOfWeek: 1, // Monday by default
        deodorizeMode: lead.deodorizeMode === 'each-visit' ? 'EACH_VISIT' :
                      lead.deodorizeMode === 'first-visit' ? 'FIRST_VISIT' : 'NONE',
        extraAreas: 0, // TODO: Calculate from areasToClean
      },
    });

    // Schedule first visit (next Monday)
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (1 + 7 - today.getDay()) % 7 || 7);
    nextMonday.setHours(9, 0, 0, 0); // 9 AM

    // Update lead with conversion info
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        convertedAt: new Date(),
        convertedToCustomerId: customer.id,
      },
    });

    // Send welcome email
    if (resend) {
      await resend.emails.send({
        from: 'Yardura <welcome@yardura.com>',
        to: lead.email,
        subject: `Welcome to Yardura, ${lead.firstName}! Your account is ready`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">Welcome to Yardura!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Your account is all set up and ready to go</p>
            </div>

            <div style="padding: 40px 30px; background: white; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 30px;">
                Hi ${lead.firstName},<br><br>
                Thank you for choosing Yardura! Your account has been successfully set up and your first service visit is scheduled.
              </p>

              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="margin: 0 0 15px 0; color: #1f2937;">Your First Visit</h3>
                <p style="margin: 0; color: #4b5563;">
                  <strong>Date:</strong> ${nextMonday.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}<br>
                  <strong>Time:</strong> 9:00 AM<br>
                  <strong>Address:</strong> ${lead.address}, ${lead.city}, ${lead.zipCode}
                </p>
              </div>

              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard"
                   style="display: inline-block; padding: 16px 32px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Access Your Dashboard
                </a>
              </div>

              <p style="font-size: 14px; color: #6b7280; text-align: center;">
                Questions? Call us at 1-888-915-YARD (9273) or reply to this email.<br>
                You can manage your service, view your history, and track your environmental impact in your dashboard.
              </p>
            </div>
          </div>
        `,
      });
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      customerId: customer.id,
      nextBillingDate: new Date((subscription as any).current_period_end * 1000).toISOString(),
      firstVisitDate: nextMonday.toISOString().split('T')[0],
      firstVisitTime: '9:00 AM',
      serviceAddress: `${lead.address}, ${lead.city}, ${lead.zipCode}`,
    });
  } catch (error) {
    console.error('Onboarding completion error:', error);
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    );
  }
}
