import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({ id: z.string() });

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    await prisma.alert.update({ where: { id: data.id }, data: { acknowledged: true } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
}

export const runtime = 'nodejs';
