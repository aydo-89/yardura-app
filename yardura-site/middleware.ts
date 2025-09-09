import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

import { getToken } from 'next-auth/jwt';

const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow Stripe webhook and public routes
  if (pathname.startsWith('/api/stripe/webhook') || pathname.startsWith('/signin')) {
    return NextResponse.next();
  }

  const requiresAuth =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/sales-rep') ||
    pathname.startsWith('/api/sales-rep') ||
    pathname === '/api/stripe/charge-service' ||
    pathname === '/api/stripe/cancel-reschedule';

  const requiresAdmin =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname === '/api/stripe/charge-service' ||
    pathname === '/api/stripe/cancel-reschedule';

  if (!requiresAuth) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const email = (token as any)?.email?.toLowerCase();

  if (!email) {
    const url = new URL('/signin', req.url);
    url.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Check if route requires admin
  if (requiresAdmin && !adminEmails.includes(email)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // For sales rep routes, check if user is sales rep or admin
  if (pathname.startsWith('/sales-rep') || pathname.startsWith('/api/sales-rep')) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { role: true },
    });

    if (!user || (user.role !== 'SALES_REP' && !adminEmails.includes(email))) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/stripe/charge-service',
    '/api/stripe/cancel-reschedule',
  ],
};
