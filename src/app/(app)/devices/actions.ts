'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';
import { syncSheetToNormalized } from '@/lib/sync-sheet';

/**
 * 모든 confirmed sheet를 재동기화 — device active 변경 시 호출.
 * raw_ocr_json은 그대로 두고 device 매칭만 다시 해서 quotes/subsidies 갱신.
 * 비활성 device는 각 페이지에서 filter 제외되므로 active=false로 돌리면 그대로 반영.
 */
async function resyncAllConfirmedSheets() {
  const sb = getSupabaseAdmin();
  const { data: sheets } = await sb
    .from('price_vendor_quote_sheets')
    .select('id')
    .eq('parse_status', 'confirmed');
  for (const s of sheets ?? []) {
    try { await syncSheetToNormalized(s.id); } catch { /* 개별 시트 실패 무시 */ }
  }
}

function str(fd: FormData, k: string) {
  const v = fd.get(k);
  return v === null ? '' : String(v).trim();
}
function num(fd: FormData, k: string) {
  const v = String(fd.get(k) ?? '');
  return v === '' ? null : Number(v);
}
function readFields(fd: FormData) {
  return {
    model_code: str(fd, 'model_code'),
    nickname: str(fd, 'nickname'),
    manufacturer: str(fd, 'manufacturer') || null,
    series: str(fd, 'series') || null,
    storage: str(fd, 'storage') || null,
    retail_price_krw: num(fd, 'retail_price_krw') ?? 0,
    category: str(fd, 'category') || '5G',
    is_new: fd.get('is_new') === 'on',
    display_order: num(fd, 'display_order') ?? 0,
    active: fd.get('active') === 'on',
  };
}

export async function createDevice(fd: FormData) {
  const data = readFields(fd);
  if (!data.model_code || !data.nickname) throw new Error('model_code/nickname 필수');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_devices').insert(data);
  if (error) throw new Error(error.message);
  if (data.active) await resyncAllConfirmedSheets();
  revalidatePath('/devices');
  revalidatePath('/subsidies');
  revalidatePath('/rebates');
  revalidatePath('/matrix');
  revalidatePath('/publish');
}

export async function updateDevice(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('id 누락');
  const data = readFields(fd);
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_devices').update(data).eq('id', id);
  if (error) throw new Error(error.message);
  // model_code/nickname 변경 시 매칭 달라질 수 있어 재sync
  await resyncAllConfirmedSheets();
  revalidatePath('/devices');
  revalidatePath('/subsidies');
  revalidatePath('/rebates');
  revalidatePath('/matrix');
  revalidatePath('/publish');
}

export async function deleteDevice(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('id 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_devices').delete().eq('id', id);
  if (error) throw new Error(error.message);
  // FK cascade로 quotes/subsidies/margins/aliases도 정리됨, 하지만 재sync는 필요 없음 (남은 데이터만 렌더)
  revalidatePath('/devices');
  revalidatePath('/subsidies');
  revalidatePath('/rebates');
  revalidatePath('/matrix');
  revalidatePath('/publish');
}

/** 단일 디바이스 활성화/비활성화 즉시 토글 — 관련 sheet 자동 재sync */
export async function toggleDeviceActive(input: { id: string; active: boolean }) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_devices').update({ active: input.active }).eq('id', input.id);
  if (error) throw new Error(error.message);
  // active=true로 켰을 때만 재sync (raw_ocr_json에 있던 매칭 재시도)
  // active=false는 페이지의 .eq('active',true) 필터로 자동 제외되므로 sync 불필요
  if (input.active) await resyncAllConfirmedSheets();
  revalidatePath('/devices');
  revalidatePath('/subsidies');
  revalidatePath('/rebates');
  revalidatePath('/matrix');
  revalidatePath('/publish');
  return { ok: true };
}

/** 벌크 활성화 상태 변경 — 관련 sheet 자동 재sync */
export async function bulkSetActive(input: { ids: string[]; active: boolean }) {
  if (input.ids.length === 0) return { ok: true, count: 0 };
  const sb = getSupabaseAdmin();
  const { error, count } = await sb
    .from('price_devices')
    .update({ active: input.active }, { count: 'exact' })
    .in('id', input.ids);
  if (error) throw new Error(error.message);
  if (input.active) await resyncAllConfirmedSheets();
  revalidatePath('/devices');
  revalidatePath('/subsidies');
  revalidatePath('/rebates');
  revalidatePath('/matrix');
  revalidatePath('/publish');
  return { ok: true, count };
}
