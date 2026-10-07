import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('seyora_session')?.value;
  let role: string | undefined;
  const key = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? undefined : 'development-only-change-this-secret-at-least-32-chars');
  if (token && key) {
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(key));
      role = typeof payload.role === 'string' ? payload.role : undefined;
    } catch { role = undefined; }
  }
  const adminPath = request.nextUrl.pathname.startsWith('/admin');
  if (!role || (adminPath && role !== 'ADMIN')) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/account/:path*'] };
