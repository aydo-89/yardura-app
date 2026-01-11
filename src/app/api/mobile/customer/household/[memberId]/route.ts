import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

// DELETE - Revoke household member access
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;
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
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
  }

  // Verify member belongs to this customer
  const member = await prisma.householdMember.findFirst({
    where: {
      id: memberId,
      customerId: customer.id,
    },
  });

  if (!member) {
    return NextResponse.json({ ok: false, error: 'Member not found' }, { status: 404 });
  }

  // Revoke access (soft delete - keep record)
  await prisma.householdMember.update({
    where: { id: memberId },
    data: {
      status: 'REVOKED',
      inviteToken: null,
    },
  });

  return NextResponse.json({ ok: true });
}
