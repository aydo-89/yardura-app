import { NextRequest, NextResponse } from 'next/server';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { deposits } from '@/lib/supabase';
import { computeEcoStats } from '@/lib/eco';

function isAdmin(email?: string | null) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && adminEmails.includes(email.toLowerCase());
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
  const totalDeposits = list.reduce((s, d) => s + (d.count || 0), 0);
  const totalWeight = list.reduce((s, d) => s + (d.weight_grams || 0), 0);
  const stats = computeEcoStats({ totalDeposits, totalWeightGrams: totalWeight });

  return NextResponse.json({ stats, range: { from, to }, samples: list.length });
}
