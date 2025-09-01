import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMITS = {
  api: { max: 100, windowMs: 60 * 1000 }, // 100 requests per minute for API routes
  page: { max: 500, windowMs: 60 * 1000 }, // 500 requests per minute for pages
};

// Security headers
const securityHeaders = {
  'X-DNS-Prefetch-Control': 'on',
  'X-XSS-Protection': '1; mode=block',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function checkRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMITS,
  request: NextRequest
): boolean {
  const now = Date.now();
  const limit = RATE_LIMITS[type];
  const key = `${type}:${identifier}`;

  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + limit.windowMs
    });
    return true;
  }

  if (record.count >= limit.max) {
    return false;
  }

  // Increment counter
  record.count++;
  rateLimitStore.set(key, record);
  return true;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Get IP address from headers (Next.js removed request.ip in newer versions)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
             request.headers.get('x-real-ip') ||
             request.headers.get('cf-connecting-ip') ||
             request.headers.get('x-client-ip') ||
             'unknown';

  // Skip rate limiting for static assets, Next.js internal routes, and NextAuth
  if (
    pathname.startsWith('/_next/') ||
    !pathname.startsWith('/api/') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth/')
  ) {
    // Apply security headers to all requests
    const response = NextResponse.next();
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // Rate limiting for API routes
  if (pathname.startsWith('/api/')) {
    const allowed = checkRateLimit(ip, 'api', request);
    if (!allowed) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too many requests',
          retryAfter: Math.ceil((rateLimitStore.get(`api:${ip}`)?.resetTime || Date.now() + 60000 - Date.now()) / 1000)
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimitStore.get(`api:${ip}`)?.resetTime || Date.now() + 60000 - Date.now()) / 1000).toString(),
            ...securityHeaders
          }
        }
      );
    }
  }

  // Rate limiting for page routes
  const allowed = checkRateLimit(ip, 'page', request);
  if (!allowed) {
    return new NextResponse(
      'Too many requests. Please try again later.',
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitStore.get(`page:${ip}`)?.resetTime || Date.now() + 60000 - Date.now()) / 1000).toString(),
          ...securityHeaders
        }
      }
    );
  }

  // Apply security headers
  const response = NextResponse.next();
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (handled separately above)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
