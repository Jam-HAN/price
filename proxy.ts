import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GATE_COOKIE = 'dbp_price_gate';
const PUBLIC_PATHS = ['/login', '/api/login', '/_next', '/favicon.ico'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const password = process.env.INTERNAL_PASSWORD;
  if (!password) return NextResponse.next();

  const token = request.cookies.get(GATE_COOKIE)?.value;
  if (token === password) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
