import { NextResponse } from 'next/server';
import { GATE_COOKIE, GATE_MAX_AGE_SEC, signGateToken } from '@/lib/gate';

export async function POST(req: Request) {
  const expected = process.env.INTERNAL_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'INTERNAL_PASSWORD is not configured' }, { status: 500 });
  }

  const form = await req.formData();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/');

  if (password !== expected) {
    const url = new URL('/login', req.url);
    url.searchParams.set('error', '1');
    if (next !== '/') url.searchParams.set('next', next);
    return NextResponse.redirect(url, { status: 303 });
  }

  const token = await signGateToken();
  const target = next.startsWith('/') ? next : '/';
  const res = NextResponse.redirect(new URL(target, req.url), { status: 303 });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GATE_MAX_AGE_SEC,
  });
  return res;
}
