import { SignJWT, jwtVerify } from 'jose';

export const GATE_COOKIE = 'dbp_price_gate';
export const GATE_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7일

function getSecret(): Uint8Array {
  const pw = process.env.INTERNAL_PASSWORD;
  if (!pw) throw new Error('INTERNAL_PASSWORD not configured');
  return new TextEncoder().encode(`price-gate:${pw}`);
}

export async function signGateToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ v: 1 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + GATE_MAX_AGE_SEC)
    .sign(getSecret());
}

export async function verifyGateToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    return true;
  } catch {
    return false;
  }
}
