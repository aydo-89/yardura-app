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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
) {
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

  const { leadId } = await params;

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        status: true,
        createdById: true,
        convertedAt: true,
        convertedToCustomerId: true,
      },
    });

    if (!lead) {
      return NextResponse.json(
        { ok: false, error: 'Lead not found' },
        { status: 404 },
      );
    }

    // Verify the lead belongs to the requesting user
    if (lead.createdById !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Access denied' },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: lead.status,
      convertedAt: lead.convertedAt,
      customerId: lead.convertedToCustomerId,
    });
  } catch (error) {
    console.error('Failed to get lead status:', error);
    const message = error instanceof Error ? error.message : 'Failed to get lead status';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
