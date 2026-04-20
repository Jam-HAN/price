import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { count, error } = await sb.from('price_vendors').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, vendors: count ?? 0 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
