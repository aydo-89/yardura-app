import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/database';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;

  try {
    if (!sig || !endpointSecret) {
      throw new Error('Missing webhook signature or secret');
    }

    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSuccess(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailure(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancellation(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: any) {
  const { visit_id, customer_id } = paymentIntent.metadata;

  if (visit_id && customer_id) {
    // Update service visit with successful payment
    await db.updateServiceVisit(visit_id, {
      stripePaymentIntentId: paymentIntent.id,
      status: 'completed',
      completedDate: new Date(),
    });

    // Activate customer if this was their first payment
    const customer = await db.getCustomer(customer_id);
    if (customer && customer.status === 'pending') {
      await db.updateCustomer(customer_id, { status: 'active' });
    }

    console.log(`Payment successful for visit ${visit_id}, customer ${customer_id}`);
  }
}

async function handlePaymentFailure(paymentIntent: any) {
  const { visit_id, customer_id } = paymentIntent.metadata;

  if (visit_id) {
    // Mark visit as having payment issues
    await db.updateServiceVisit(visit_id, {
      notes: `Payment failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
    });

    console.log(`Payment failed for visit ${visit_id}, customer ${customer_id}`);
  }
}

async function handleInvoicePaymentSuccess(invoice: any) {
  console.log(`Invoice payment succeeded: ${invoice.id}`);

  // You can add additional logic here for invoice-specific handling
  // For example, updating subscription status or sending confirmation emails
}

async function handleInvoicePaymentFailure(invoice: any) {
  console.log(`Invoice payment failed: ${invoice.id}`);

  // Handle failed invoice payments
  // This might involve pausing service or contacting the customer
}

async function handleSubscriptionUpdate(subscription: any) {
  const customer = await db.getCustomerByStripeId(subscription.customer);

  if (customer) {
    // Update customer status based on subscription status
    let status: 'active' | 'paused' | 'cancelled' = 'active';

    if (subscription.status === 'canceled') {
      status = 'cancelled';
    } else if (subscription.status === 'past_due') {
      status = 'paused';
    }

    await db.updateCustomer(customer.id, { status });
    console.log(`Subscription updated for customer ${customer.id}: ${status}`);
  }
}

async function handleSubscriptionCancellation(subscription: any) {
  const customer = await db.getCustomerByStripeId(subscription.customer);

  if (customer) {
    await db.updateCustomer(customer.id, { status: 'cancelled' });
    console.log(`Subscription cancelled for customer ${customer.id}`);
  }
}
