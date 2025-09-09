import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const devices = await prisma.device.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ devices });
}

export const runtime = 'nodejs';
