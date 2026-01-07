import { NextResponse } from 'next/server';

import type { AppUserRole } from '@/lib/auth/roles';
import { prisma } from '@/lib/prisma';

const TEAM_ROLES: AppUserRole[] = ['OWNER', 'ADMIN', 'SALES_REP', 'TECH'];

export type CustomerSetupPrefill = {
  name: string | null;
  email: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  orgId: string | null;
};

export function canSetupCustomer(roles?: AppUserRole[] | null): boolean {
  if (!roles || roles.length === 0) return false;
  if (roles.includes('CUSTOMER')) return true;
  return TEAM_ROLES.some((role) => roles.includes(role));
}

export async function buildCustomerSetupResponse(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      address: true,
      city: true,
      zipCode: true,
      orgId: true,
    },
  });

  const setup: CustomerSetupPrefill = {
    name: user?.name ?? null,
    email: user?.email ?? null,
    addressLine1: user?.address ?? null,
    city: user?.city ?? null,
    state: null,
    zip: user?.zipCode ?? null,
    orgId: user?.orgId ?? null,
  };

  return NextResponse.json(
    {
      ok: false,
      error: 'Customer profile setup required',
      setupRequired: true,
      setup,
    },
    { status: 403 },
  );
}
