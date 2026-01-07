import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    // Get all cookies
    const cookieStore = await cookies();
    
    // List of all possible NextAuth cookie names
    const authCookieNames = [
      'next-auth.session-token',
      '__Secure-next-auth.session-token',
      'next-auth.callback-url',
      '__Secure-next-auth.callback-url',
      'next-auth.csrf-token',
      '__Host-next-auth.csrf-token',
      '__Secure-next-auth.csrf-token',
    ];
    
    // Delete all NextAuth cookies
    authCookieNames.forEach(name => {
      try {
        cookieStore.delete(name);
      } catch (e) {
        // Cookie might not exist, ignore
      }
    });
    
    // Also try to delete any cookies we can see
    const allCookies = cookieStore.getAll();
    allCookies.forEach(cookie => {
      if (cookie.name.includes('next-auth') || cookie.name.includes('session')) {
        try {
          cookieStore.delete(cookie.name);
        } catch (e) {
          // Ignore errors
        }
      }
    });
    
    // Create response with headers to clear cookies
    const response = NextResponse.json({ success: true, cleared: true }, { status: 200 });
    
    // Set headers to clear all auth cookies with all possible configurations
    const paths = ['/', '/api', '/api/auth', '/admin'];
    const domains = [
      'yardura.com',
      '.yardura.com',
      'www.yardura.com',
      '.www.yardura.com',
      'getinsightscoop.com',
      '.getinsightscoop.com',
      'www.getinsightscoop.com',
      '.www.getinsightscoop.com',
    ];
    
    authCookieNames.forEach(name => {
      // Clear for all path combinations
      paths.forEach(path => {
        // Without domain (most compatible with mobile)
        response.cookies.set(name, '', {
          expires: new Date(0),
          path: path,
          httpOnly: true,
          sameSite: 'lax',
          secure: true,
        });
        
        // With each domain
        domains.forEach(domain => {
          try {
            response.cookies.set(name, '', {
              expires: new Date(0),
              path: path,
              domain: domain,
              httpOnly: true,
              sameSite: 'lax',
              secure: true,
            });
          } catch (e) {
            // Some domain/path combinations might not work
          }
        });
      });
    });
    
    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  } catch (error) {
    console.error('Logout API error:', error);
    const response = NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}
