import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      scheduledDate,
      serviceType,
      yardSize,
      dogsServiced,
      accountNumber,
      notes,
      deodorize,
      litterService,
    } = await request.json();

    const serviceVisit = await prisma.serviceVisit.create({
      data: {
        userId: session.user.id,
        scheduledDate: new Date(scheduledDate),
        serviceType,
        yardSize,
        dogsServiced: parseInt(dogsServiced),
        accountNumber,
        notes,
        deodorize,
        litterService,
      },
    });

    return NextResponse.json({ serviceVisit });
  } catch (error) {
    console.error('Error creating service visit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    const session = (await safeGetServerSession(authOptions as any)) as {
      user?: { id?: string; email?: string };
    } | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceVisits = await prisma.serviceVisit.findMany({
      where: { userId: session.user.id },
      include: {
        dataReadings: {
          orderBy: { timestamp: 'desc' },
          take: 5,
        },
      },
      orderBy: { scheduledDate: 'desc' },
    });

    return NextResponse.json({ serviceVisits });
  } catch (error) {
    console.error('Error fetching service visits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
