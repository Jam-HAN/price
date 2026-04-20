'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function createVendor(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const carrier = String(formData.get('carrier') ?? '');
  const display_order = Number(formData.get('display_order') ?? 0);
  if (!name || !['SKT', 'KT', 'LGU+'].includes(carrier)) throw new Error('필수값 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_vendors').insert({ name, carrier, display_order });
  if (error) throw new Error(error.message);
  revalidatePath('/vendors');
}

export async function updateVendor(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const carrier = String(formData.get('carrier') ?? '');
  const display_order = Number(formData.get('display_order') ?? 0);
  const active = formData.get('active') === 'on';
  if (!id || !name) throw new Error('필수값 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_vendors').update({ name, carrier, display_order, active }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/vendors');
}

export async function deleteVendor(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_vendors').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/vendors');
}
