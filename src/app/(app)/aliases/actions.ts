'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncSheetToNormalized } from '@/lib/sync-sheet';

async function resyncAllConfirmedSheets() {
  const sb = getSupabaseAdmin();
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id')
    .eq('parse_status', 'confirmed');
  for (const s of sheets ?? []) {
    try { await syncSheetToNormalized(s.id); } catch { /* skip */ }
  }
}

export async function createAlias(fd: FormData) {
  const vendor_id = String(fd.get('vendor_id') ?? '');
  const device_id = String(fd.get('device_id') ?? '');
  const vendor_code = String(fd.get('vendor_code') ?? '').trim();
  if (!vendor_id || !device_id || !vendor_code) throw new Error('필수값 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_device_aliases').insert({ vendor_id, device_id, vendor_code });
  if (error) throw new Error(error.message);
  // 새 alias로 기존 raw_ocr_json의 unmapped 행이 매칭될 수 있음 → 재sync
  await resyncAllConfirmedSheets();
  revalidatePath('/aliases');
  revalidatePath('/subsidies');
  revalidatePath('/rebates');
  revalidatePath('/matrix');
  revalidatePath('/publish');
}

export async function deleteAlias(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('id 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_device_aliases').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await resyncAllConfirmedSheets();
  revalidatePath('/aliases');
  revalidatePath('/subsidies');
  revalidatePath('/rebates');
  revalidatePath('/matrix');
  revalidatePath('/publish');
}
