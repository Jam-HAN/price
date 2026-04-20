'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';

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
  revalidatePath('/devices');
}

export async function updateDevice(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('id 누락');
  const data = readFields(fd);
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_devices').update(data).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/devices');
}

export async function deleteDevice(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('id 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_devices').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/devices');
}
