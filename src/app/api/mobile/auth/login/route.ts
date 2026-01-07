import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

import { normalizeEmailOrThrow } from '@/lib/auth/email-normalizer';
import { sortRoles, type AppUserRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';
import { signMobileToken } from '@/lib/mobile-auth';
import { resolveStorageUrl } from '@/lib/storage';

const TEAM_ROLES: AppUserRole[] = ['OWNER', 'ADMIN', 'SALES_REP', 'TECH'];

function ensureCustomerRole(roles: Set<AppUserRole>) {
  if (TEAM_ROLES.some((role) => roles.has(role))) {
    roles.add('CUSTOMER');
  }
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

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  if (!payload?.email || !payload?.password) {
    return NextResponse.json(
      { ok: false, error: 'Email and password are required.' },
      { status: 400 },
    );
  }

  if (typeof payload.email !== 'string' || typeof payload.password !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'Email and password must be strings.' },
      { status: 400 },
    );
  }

  let email: string;
  try {
    email = normalizeEmailOrThrow(payload.email);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid email address.';
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
    },
    include: {
      accounts: true,
      customer: { select: { id: true } },
      scooperProfile: { select: { id: true } },
    },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password.' },
      { status: 401 },
    );
  }

  const credentialsAccount = user.accounts.find(
    (account) => account.provider === 'credentials',
  );

  if (!credentialsAccount?.access_token) {
    return NextResponse.json(
      { ok: false, error: 'Credentials login is not available.' },
      { status: 403 },
    );
  }

  const isValid = await bcrypt.compare(
    payload.password,
    credentialsAccount.access_token,
  );

  if (!isValid) {
    return NextResponse.json(
      { ok: false, error: 'Invalid email or password.' },
      { status: 401 },
    );
  }

  const roles = deriveRoles({
    role: user.role,
    roles: user.roles,
    customer: user.customer,
    scooperProfile: user.scooperProfile,
  });

  const activeRole: AppUserRole | null = roles.includes('CUSTOMER')
    ? 'CUSTOMER'
    : roles[0] ?? null;

  const token = signMobileToken({
    sub: user.id,
    email: user.email,
    roles,
    activeRole,
    orgId: user.orgId ?? null,
  });
  const imageUrl = await resolveStorageUrl(user.image ?? null);

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
