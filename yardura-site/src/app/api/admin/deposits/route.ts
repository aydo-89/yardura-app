import { NextRequest, NextResponse } from 'next/server';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { deposits } from '@/lib/supabase';

function isAdmin(email?: string | null) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && adminEmails.includes(email.toLowerCase());
}

export async function POST(req: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as {
    user?: { email?: string };
  } | null as { user?: { email?: string } } | null;
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const {
    customerId,
    visitId,
    timestamp,
    count,
    weight_grams,
    moisture_percent,
    c_color,
    c_content,
    c_consistency,
    notes,
  } = body || {};
  if (!customerId || !count) {
    return NextResponse.json({ error: 'customerId and count are required' }, { status: 400 });
  }

  const record = await deposits.create({
    customerId,
    visitId,
    timestamp: timestamp || new Date().toISOString(),
    count,
    weight_grams,
    moisture_percent,
    c_color,
    c_content,
    c_consistency,
    notes,
  });

  return NextResponse.json(record);
}

export async function GET(req: NextRequest) {
  const session = (await safeGetServerSession(authOptions as any)) as {
    user?: { email?: string };
  } | null;
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId');
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

  const list = await deposits.listByCustomer(customerId, from, to);
  return NextResponse.json(list);
}
