import { NextResponse } from 'next/server';
import { safeGetServerSession } from '@/lib/auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';

function isAdmin(email?: string | null) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return !!email && adminEmails.includes(email.toLowerCase());
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await safeGetServerSession(authOptions as any)) as {
    user?: { email?: string };
  } | null;
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, description, active } = body || {};

  const product = await stripe.products.update(id, { name, description, active });
  return NextResponse.json(product);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = (await safeGetServerSession(authOptions as any)) as {
    user?: { email?: string };
  } | null;
  if (!isAdmin(session?.user?.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const deleted = await stripe.products.update(id, { active: false });
  return NextResponse.json(deleted);
}
