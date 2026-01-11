import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { calculatePrice } from '@/lib/priceEstimator';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required' },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      dogs,
      yardSize,
      frequency,
      deodorize,
      serviceType,
      source,
      pricingBreakdown,
    } = body;

    // Validate required fields
    if (!email || !address || !city || !state || !zipCode) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Calculate pricing if not provided
    let pricing = pricingBreakdown;
    if (!pricing) {
      pricing = await calculatePrice({
        dogs: dogs || 1,
        yardSize: yardSize || 'medium',
        frequency: frequency || 'weekly',
        addons: {
          deodorize: deodorize || false,
        },
        businessId: 'yardura',
      });
    }

    // Get user's orgId or default to yardura
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { orgId: true },
    });
    const orgId = user?.orgId || 'yardura';

    // Create the lead
    const lead = await prisma.lead.create({
      data: {
        orgId,
        firstName: firstName || '',
        lastName: lastName || '',
        email,
        phone: phone || null,
        address,
        city,
        state,
        zipCode,
        dogs: dogs || 1,
        yardSize: yardSize || 'medium',
        frequency: frequency || 'weekly',
        deodorize: deodorize || false,
        serviceType: serviceType || 'residential',
        source: source || 'mobile-app-upgrade',
        status: 'QUALIFIED',
        pricingBreakdown: pricing,
        submittedAt: new Date(),
        createdById: userId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        dogs: true,
        yardSize: true,
        frequency: true,
      },
    });

    return NextResponse.json({
      ok: true,
      lead,
    });
  } catch (error) {
    console.error('Failed to create lead:', error);
    const message = error instanceof Error ? error.message : 'Failed to create lead';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
