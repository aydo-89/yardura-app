import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
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
    const { visitId, action, newDate, reason } = await request.json();

    if (!visitId || !action) {
      return NextResponse.json({ error: 'Visit ID and action are required' }, { status: 400 });
    }

    const visit = await db.getServiceVisit(visitId);
    if (!visit) {
      return NextResponse.json({ error: 'Service visit not found' }, { status: 404 });
    }

    if (visit.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot modify a completed service visit' },
        { status: 400 }
      );
    }

    const customer = await db.getCustomer(visit.customerId);
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (action === 'cancel') {
      // Cancel the service visit
      await db.updateServiceVisit(visit.id, {
        status: 'cancelled',
        notes: reason || 'Service cancelled by customer',
      });

      // For recurring services, we don't charge for cancelled visits
      // The subscription will continue, but this specific visit won't be charged

      return NextResponse.json({
        success: true,
        message: 'Service visit cancelled successfully',
        visitId: visit.id,
      });
    } else if (action === 'reschedule') {
      if (!newDate) {
        return NextResponse.json(
          { error: 'New date is required for rescheduling' },
          { status: 400 }
        );
      }

      const newServiceDate = new Date(newDate);

      // Validate the new date is in the future
      if (newServiceDate <= new Date()) {
        return NextResponse.json(
          { error: 'New service date must be in the future' },
          { status: 400 }
        );
      }

      // Validate the new date is on the customer's service day
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const newDayIndex = newServiceDate.getDay();
      const customerDayIndex = days.indexOf(customer.serviceDay.toLowerCase());

      if (newDayIndex !== customerDayIndex) {
        return NextResponse.json(
          {
            error: `New date must be on customer's service day (${customer.serviceDay})`,
            suggestedDate: calculateNextValidDate(customer.serviceDay, newServiceDate),
          },
          { status: 400 }
        );
      }

      // Update the service visit
      await db.updateServiceVisit(visit.id, {
        status: 'rescheduled',
        scheduledDate: newServiceDate,
        notes: reason || 'Service rescheduled by customer',
      });

      return NextResponse.json({
        success: true,
        message: 'Service visit rescheduled successfully',
        visitId: visit.id,
        newDate: newServiceDate,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "cancel" or "reschedule"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Cancel/reschedule error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// Helper function to calculate next valid date for customer's service day
function calculateNextValidDate(serviceDay: string, referenceDate: Date): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDayIndex = days.indexOf(serviceDay.toLowerCase());

  const nextDate = new Date(referenceDate);
  const currentDayIndex = nextDate.getDay();

  let daysToAdd = targetDayIndex - currentDayIndex;
  if (daysToAdd <= 0) {
    daysToAdd += 7; // Next week
  }

  nextDate.setDate(nextDate.getDate() + daysToAdd);
  nextDate.setHours(9, 0, 0, 0); // 9 AM

  return nextDate;
}
