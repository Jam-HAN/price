import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), { status: 303 });
  res.cookies.delete('dbp_price_gate');
  return res;
}
