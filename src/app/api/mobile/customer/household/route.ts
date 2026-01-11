import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';

import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/mobile-auth';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token;
}

const ROLE_LABELS: Record<string, string> = {
  FAMILY_MEMBER: 'Family Member',
  DOG_SITTER: 'Dog Sitter',
  DOG_WALKER: 'Dog Walker',
  HOUSE_SITTER: 'House Sitter',
  EMERGENCY_CONTACT: 'Emergency Contact',
};

// GET - List household members
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
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
  }

  const members = await prisma.householdMember.findMany({
    where: { customerId: customer.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      lastAccessAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    ok: true,
    members: members.map((m) => ({
      ...m,
      roleLabel: ROLE_LABELS[m.role] ?? m.role,
      isExpired: m.expiresAt ? new Date(m.expiresAt) < new Date() : false,
    })),
  });
}

const InviteSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['FAMILY_MEMBER', 'DOG_SITTER', 'DOG_WALKER', 'HOUSE_SITTER', 'EMERGENCY_CONTACT']),
  expiresAt: z.string().datetime().optional().nullable(),
});

// POST - Invite a new household member
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
    return NextResponse.json({ ok: false, error: 'Customer access required' }, { status: 403 });
  }

  const customer = await prisma.customer.findFirst({
    where: { userId },
    select: { id: true, name: true },
  });

  if (!customer) {
    return NextResponse.json({ ok: false, error: 'Customer not found' }, { status: 404 });
  }

  let body: z.infer<typeof InviteSchema>;
  try {
    body = InviteSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  // Check if member already exists
  const existing = await prisma.householdMember.findUnique({
    where: {
      customerId_email: {
        customerId: customer.id,
        email: body.email.toLowerCase(),
      },
    },
  });

  if (existing) {
    if (existing.status === 'REVOKED' || existing.status === 'EXPIRED') {
      // Reactivate revoked/expired member
      const inviteToken = randomBytes(32).toString('hex');
      const updated = await prisma.householdMember.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          role: body.role,
          status: 'PENDING',
          inviteToken,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        },
      });
      return NextResponse.json({
        ok: true,
        member: {
          ...updated,
          roleLabel: ROLE_LABELS[updated.role] ?? updated.role,
        },
        inviteToken,
      });
    }
    return NextResponse.json(
      { ok: false, error: 'This person is already a household member' },
      { status: 409 },
    );
  }

  // Create new member
  const inviteToken = randomBytes(32).toString('hex');
  const member = await prisma.householdMember.create({
    data: {
      customerId: customer.id,
      name: body.name,
      email: body.email.toLowerCase(),
      role: body.role,
      status: 'PENDING',
      inviteToken,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });

  // TODO: Send invite email with link to accept

  return NextResponse.json({
    ok: true,
    member: {
      ...member,
      roleLabel: ROLE_LABELS[member.role] ?? member.role,
    },
    inviteToken, // Return for testing, production would send via email
  });
}
