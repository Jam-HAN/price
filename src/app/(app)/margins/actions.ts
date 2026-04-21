'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function upsertMargin(input: {
  id?: string;
  scope_type: 'global' | 'series' | 'device';
  device_id: string | null;
  series: string | null;
  margin_krw: number;
}) {
  const sb = getSupabaseAdmin();
  if (input.scope_type === 'device' && !input.device_id) throw new Error('device_id 필수');
  if (input.scope_type === 'series' && !input.series) throw new Error('series 필수');

  const payload = {
    scope_type: input.scope_type,
    device_id: input.scope_type === 'device' ? input.device_id : null,
    series: input.scope_type === 'series' ? input.series : null,
    margin_krw: input.margin_krw,
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb
    .from('price_device_margins')
    .upsert(payload, { onConflict: 'scope_type,device_id,series' });
  if (error) throw new Error(error.message);

  revalidatePath('/margins');
  revalidatePath('/publish');
  return { ok: true };
}

export async function deleteMargin(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_device_margins').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/margins');
  revalidatePath('/publish');
  return { ok: true };
}
