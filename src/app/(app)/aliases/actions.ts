'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function createAlias(fd: FormData) {
  const vendor_id = String(fd.get('vendor_id') ?? '');
  const device_id = String(fd.get('device_id') ?? '');
  const vendor_code = String(fd.get('vendor_code') ?? '').trim();
  if (!vendor_id || !device_id || !vendor_code) throw new Error('필수값 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_device_aliases').insert({ vendor_id, device_id, vendor_code });
  if (error) throw new Error(error.message);
  revalidatePath('/aliases');
}

export async function deleteAlias(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  if (!id) throw new Error('id 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_device_aliases').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/aliases');
}
