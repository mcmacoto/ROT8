import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Set standard security headers
  const response = NextResponse.next();
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Check admin UI route protection: /admin/[sessionId]
  // Note: Detailed database validation of host token hash happens in server route handlers / page server components
  const adminMatch = pathname.match(/^\/admin\/([a-zA-Z0-9_-]+)/);
  if (adminMatch) {
    const sessionId = adminMatch[1];
    if (sessionId === 'login' || pathname.endsWith('/login')) {
      return response;
    }
    const hostToken = request.cookies.get(`host_token_${sessionId}`)?.value || request.cookies.get('rot8_host_token')?.value;

    // If accessing admin page without any token cookie, redirect to login page
    if (!hostToken && !pathname.includes('/api/')) {
      const url = request.nextUrl.clone();
      url.pathname = `/admin/${sessionId}/login`;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
  ],
};
