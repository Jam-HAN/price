import { NextResponse } from 'next/server';

const GATE_COOKIE = 'dbp_price_gate';

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

  const target = next.startsWith('/') ? next : '/';
  const res = NextResponse.redirect(new URL(target, req.url), { status: 303 });
  res.cookies.set(GATE_COOKIE, expected, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
