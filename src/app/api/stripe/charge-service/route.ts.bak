import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/database';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions as any) as { user?: { email?: string } } | null;
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!session || !session.user || !session.user.email || !adminEmails.includes(session.user.email.toLowerCase())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { visitId, notes } = await request.json();

    if (!visitId) {
      return NextResponse.json(
        { error: 'Visit ID is required' },
        { status: 400 }
      );
    }

    // Get the service visit
    const visit = await db.getServiceVisit(visitId);
    if (!visit) {
      return NextResponse.json(
        { error: 'Service visit not found' },
        { status: 404 }
      );
    }

    if (visit.status === 'completed') {
      return NextResponse.json(
        { error: 'Service visit already completed and charged' },
        { status: 400 }
      );
    }

    // Get customer details
    const customer = await db.getCustomer(visit.customerId);
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Create payment intent for the service charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(visit.amount * 100), // Convert to cents
      currency: 'usd',
      customer: customer.stripeCustomerId,
      payment_method_types: ['card'],
      off_session: true, // Charge without customer present
      confirm: true, // Automatically confirm the payment
      metadata: {
        visit_id: visit.id,
        customer_id: customer.id,
        service_date: visit.scheduledDate.toISOString(),
        service_type: 'yardura_dog_waste_removal',
      },
      description: `Yardura service - ${customer.frequency} visit for ${customer.dogs} dog${customer.dogs > 1 ? 's' : ''}`,
    });

    // Update the service visit as completed
    await db.updateServiceVisit(visit.id, {
      status: 'completed',
      completedDate: new Date(),
      stripePaymentIntentId: paymentIntent.id,
      notes,
    });

    // Create commission record if customer has a sales rep
    if (customer.salesRepId) {
      const salesRep = await prisma.user.findUnique({
        where: { id: customer.salesRepId },
        select: { commissionRate: true }
      });

      if (salesRep?.commissionRate) {
        const commissionAmount = visit.amount * salesRep.commissionRate;

        await prisma.commission.create({
          data: {
            salesRepId: customer.salesRepId,
            customerId: customer.id,
            serviceVisitId: visit.id,
            amount: commissionAmount,
            status: 'PENDING',
          }
        });
      }
    }

    // If this is the first completed service, activate the customer
    if (customer.status === 'pending') {
      await db.updateCustomer(customer.id, { status: 'active' });
    }

    // Schedule next service visit if recurring
    if (customer.frequency !== 'one-time') {
      const nextVisitDate = calculateNextServiceDate(
        customer.serviceDay,
        visit.scheduledDate
      );

      await db.createServiceVisit({
        customerId: customer.id,
        scheduledDate: nextVisitDate,
        status: 'scheduled',
        amount: visit.amount, // Same amount for recurring services
      });
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      amount: visit.amount,
      nextVisitDate: customer.frequency !== 'one-time'
        ? calculateNextServiceDate(customer.serviceDay, visit.scheduledDate)
        : null,
    });

  } catch (error: any) {
    console.error('Service charge error:', error);

    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json(
        {
          error: 'Payment failed',
          details: error.message,
          code: error.code
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process service charge' },
      { status: 500 }
    );
  }
}

// Helper function to calculate next service date
function calculateNextServiceDate(serviceDay: string, lastServiceDate: Date): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayIndex = days.indexOf(serviceDay.toLowerCase());

  const nextDate = new Date(lastServiceDate);
  nextDate.setDate(lastServiceDate.getDate() + 7); // Add one week

  // Adjust to the correct day of the week
  const currentDayIndex = nextDate.getDay();
  let dayDifference = targetDayIndex - currentDayIndex;

  nextDate.setDate(nextDate.getDate() + dayDifference);
  nextDate.setHours(9, 0, 0, 0); // 9 AM

  return nextDate;
}
