import { NextRequest, NextResponse } from 'next/server';

import { sortRoles, type AppUserRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { resolveStorageUrl } from '@/lib/storage';

const TEAM_ROLES: AppUserRole[] = ['OWNER', 'ADMIN', 'SALES_REP', 'TECH'];

function ensureCustomerRole(roles: Set<AppUserRole>) {
  if (TEAM_ROLES.some((role) => roles.has(role))) {
    roles.add('CUSTOMER');
  }
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

function getPreferredRole(request: NextRequest): AppUserRole | null {
  const header = request.headers.get('x-preferred-role');
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  return trimmed as AppUserRole;
}

function deriveRoles(user: {
  role: string | null;
  roles?: string[] | null;
  customer: { id: string } | null;
  scooperProfile: { id: string } | null;
}): AppUserRole[] {
  const roles = new Set<AppUserRole>();
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    user.roles.forEach((role) => roles.add(role as AppUserRole));
  } else {
    if (user.role) {
      roles.add(user.role as AppUserRole);
    }
    if (user.customer) {
      roles.add('CUSTOMER');
    }
    if (user.scooperProfile) {
      roles.add('TECH');
    }
  }
  ensureCustomerRole(roles);
  return sortRoles(roles);
}

export async function GET(request: NextRequest) {
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
      { ok: false, error: 'Invalid token' },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      orgId: true,
      address: true,
      city: true,
      zipCode: true,
      role: true,
      roles: true,
      customer: { select: { id: true } },
      scooperProfile: { select: { id: true } },
    },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'User not found' },
      { status: 404 },
    );
  }

  const roles = deriveRoles({
    role: user.role,
    roles: user.roles,
    customer: user.customer,
    scooperProfile: user.scooperProfile,
  });

  const preferredRole = getPreferredRole(request);
  const activeRole =
    preferredRole && roles.includes(preferredRole)
      ? preferredRole
      : payload.activeRole && roles.includes(payload.activeRole)
        ? payload.activeRole
        : roles.includes('CUSTOMER')
          ? 'CUSTOMER'
          : roles[0] ?? null;
  const imageUrl = await resolveStorageUrl(user.image);

  return NextResponse.json({
    ok: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        orgId: user.orgId ?? null,
        customerId: user.customer?.id ?? null,
        scooperProfileId: user.scooperProfile?.id ?? null,
        imageUrl,
        address: user.address ?? null,
        city: user.city ?? null,
        zipCode: user.zipCode ?? null,
      },
      roles,
      activeRole,
    },
  });
}
