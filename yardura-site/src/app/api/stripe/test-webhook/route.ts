import { NextRequest, NextResponse } from 'next/server';

// Simple test webhook endpoint for development
// You can use this to test your webhook locally before setting up the production one
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const event = JSON.parse(body);

    console.log('🎯 Test Webhook received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('✅ Payment succeeded:', event.data.object.id);
        break;
      case 'payment_intent.payment_failed':
        console.log('❌ Payment failed:', event.data.object.id);
        break;
      case 'customer.subscription.created':
        console.log('📋 Subscription created:', event.data.object.id);
        break;
      default:
        console.log('📨 Unhandled event:', event.type);
    }

    return NextResponse.json({ received: true, event: event.type });
  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json({ error: 'Test webhook processing failed' }, { status: 500 });
  }
}
