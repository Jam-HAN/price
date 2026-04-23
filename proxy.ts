import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { GATE_COOKIE, verifyGateToken } from '@/lib/gate';

const PUBLIC_PATHS = ['/login', '/api/login', '/_next', '/favicon.ico'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const password = process.env.INTERNAL_PASSWORD;
  if (!password) {
    // fail-close: 환경변수 누락 시 관리자 페이지 자체를 차단
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'misconfig');
    return NextResponse.redirect(loginUrl);
  }

  const token = request.cookies.get(GATE_COOKIE)?.value;
  if (await verifyGateToken(token)) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
