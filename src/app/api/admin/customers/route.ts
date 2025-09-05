import { NextRequest, NextResponse } from 'next/server';

import type { YarduraCustomer, ServiceVisit } from '@/lib/database';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';

interface CustomerWithVisits extends YarduraCustomer {
  upcomingVisits: ServiceVisit[];
  lastVisit?: ServiceVisit;
}

export async function GET(_request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { email?: string };
    } | null;
    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (
      !session ||
      !session.user ||
      !session.user.email ||
      !adminEmails.includes(session.user.email.toLowerCase())
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // In a real implementation, this would fetch from your database
    // For now, we'll return a sample customer to demonstrate the dashboard

    const sampleCustomers: CustomerWithVisits[] = [
      {
        id: 'cust_sample_1',
        stripeCustomerId: 'cus_sample_123',
        email: 'john.doe@example.com',
        name: 'John Doe',
        phone: '(888) 555-0123',
        address: '123 Main St',
        city: 'Minneapolis',
        zip: '55401',
        serviceDay: 'monday',
        frequency: 'weekly',
        yardSize: 'medium',
        dogs: 2,
        addOns: { deodorize: false, litter: true },
        dataOptIn: true,
        stripeSubscriptionId: 'sub_sample_123',
        stripePriceId: 'price_weekly_medium_2dog',
        status: 'active',
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15'),
        upcomingVisits: [
          {
            id: 'visit_sample_1',
            customerId: 'cust_sample_1',
            scheduledDate: new Date('2024-01-22'),
            status: 'scheduled',
            amount: 24.0,
            createdAt: new Date('2024-01-15'),
            updatedAt: new Date('2024-01-15'),
          },
        ],
      },
    ];

    return NextResponse.json(sampleCustomers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}
