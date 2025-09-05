import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({ jobId: z.string(), action: z.enum(['reschedule', 'skip']), nextVisitAt: z.string().optional() });

export async function POST(req: NextRequest) {
  try {
    const data = schema.parse(await req.json());
    if (data.action === 'reschedule') {
      if (!data.nextVisitAt) return NextResponse.json({ error: 'nextVisitAt required' }, { status: 400 });
      await prisma.job.update({ where: { id: data.jobId }, data: { nextVisitAt: new Date(data.nextVisitAt) } });
    } else if (data.action === 'skip') {
      await prisma.job.update({ where: { id: data.jobId }, data: { nextVisitAt: null } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
}

export const runtime = 'nodejs';
