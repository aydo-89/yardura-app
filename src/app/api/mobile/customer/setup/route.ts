import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { sortRoles, type AppUserRole } from '@/lib/auth/roles';
import { normalizeAddressParts } from '@/lib/address/normalize';
import { canSetupCustomer } from '@/lib/mobile/customer-setup';
import { geocodeAddress } from '@/lib/google/maps';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const setupSchema = z.object({
  name: z.string().trim().min(1),
  addressLine1: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  zip: z.string().trim().min(1),
  phone: z.string().trim().min(4).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!canSetupCustomer(payload.roles)) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid setup payload', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      orgId: true,
      role: true,
      roles: true,
    },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
  }

  const setup = parsed.data;
  const orgId = user.orgId ?? payload.orgId ?? 'yardura';
  const email = user.email ?? null;

  // Geocode the address to get lat/lng for poop map and parcel lookup
  const fullAddress = `${setup.addressLine1}, ${setup.city}, ${setup.state} ${setup.zip}`;
  let latitude: number | null = null;
  let longitude: number | null = null;
  
  try {
    const geocodeResult = await geocodeAddress(fullAddress);
    if (geocodeResult) {
      latitude = geocodeResult.location.lat;
      longitude = geocodeResult.location.lng;
    }
  } catch (geocodeError) {
    console.warn('[customer-setup] Geocoding failed:', geocodeError);
    // Continue without coordinates - poop map will show "add address" but setup still works
  }

  const existingByUser = await prisma.customer.findFirst({
    where: { userId },
  });

  let customer = existingByUser;

  if (!customer && email) {
    const existingByEmail = await prisma.customer.findFirst({
      where: { email },
    });
    if (existingByEmail?.userId && existingByEmail.userId !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Customer account already linked to another user' },
        { status: 409 },
      );
    }
    customer = existingByEmail;
  }

  if (customer) {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        userId,
        orgId,
        name: setup.name.trim(),
        email,
        addressLine1: setup.addressLine1.trim(),
        city: setup.city.trim(),
        state: setup.state.trim(),
        zip: setup.zip.trim(),
        phone: setup.phone ?? customer.phone ?? null,
        latitude,
        longitude,
      },
    });
  } else {
    customer = await prisma.customer.create({
      data: {
        userId,
        orgId,
        name: setup.name.trim(),
        email,
        addressLine1: setup.addressLine1.trim(),
        city: setup.city.trim(),
        state: setup.state.trim(),
        zip: setup.zip.trim(),
        phone: setup.phone ?? null,
        latitude,
        longitude,
      },
    });
  }

  const desiredRoles = sortRoles(
    new Set<AppUserRole>([
      ...(payload.roles ?? []),
      ...(user.role ? [user.role as AppUserRole] : []),
      'CUSTOMER',
    ]),
  );

  await prisma.user.update({
    where: { id: userId },
    data: {
      roles: desiredRoles,
      address: setup.addressLine1.trim(),
      city: setup.city.trim(),
      zipCode: setup.zip.trim(),
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      customerId: customer.id,
      customer: {
        id: customer.id,
        name: customer.name,
        addressLine1: customer.addressLine1,
        city: customer.city,
        state: customer.state,
        zip: customer.zip,
        latitude: customer.latitude,
        longitude: customer.longitude,
      },
    },
  });
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyMobileToken>;
  try {
    payload = verifyMobileToken(token);
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!canSetupCustomer(payload.roles)) {
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const [user, customer] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        address: true,
        city: true,
        zipCode: true,
        orgId: true,
      },
    }),
    prisma.customer.findFirst({
      where: { userId },
      select: {
        id: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
      },
    }),
  ]);

  const normalizedAddress = normalizeAddressParts({
    addressLine1: customer?.addressLine1 ?? user?.address ?? null,
    city: customer?.city ?? user?.city ?? null,
    state: customer?.state ?? null,
    zip: customer?.zip ?? user?.zipCode ?? null,
  });

  return NextResponse.json({
    ok: true,
    data: {
      hasCustomer: Boolean(customer),
      setup: {
        name: user?.name ?? null,
        email: user?.email ?? null,
        addressLine1: normalizedAddress.addressLine1 ?? null,
        city: normalizedAddress.city ?? null,
        state: normalizedAddress.state ?? null,
        zip: normalizedAddress.zip ?? null,
        orgId: user?.orgId ?? null,
      },
    },
  });
}
