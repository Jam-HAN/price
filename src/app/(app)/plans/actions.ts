'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function createTier(formData: FormData) {
  const carrier = String(formData.get('carrier') ?? '');
  const code = String(formData.get('code') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const monthlyRaw = String(formData.get('monthly_fee_krw') ?? '');
  const monthly_fee_krw = monthlyRaw ? Number(monthlyRaw) : null;
  const display_order = Number(formData.get('display_order') ?? 0);
  if (!carrier || !code || !label) throw new Error('필수값 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('price_plan_tiers')
    .insert({ carrier, code, label, monthly_fee_krw, display_order });
  if (error) throw new Error(error.message);
  revalidatePath('/plans');
}

export async function updateTier(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const code = String(formData.get('code') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const monthlyRaw = String(formData.get('monthly_fee_krw') ?? '');
  const monthly_fee_krw = monthlyRaw ? Number(monthlyRaw) : null;
  const display_order = Number(formData.get('display_order') ?? 0);
  const active = formData.get('active') === 'on';
  if (!id || !code || !label) throw new Error('필수값 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from('price_plan_tiers')
    .update({ code, label, monthly_fee_krw, display_order, active })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/plans');
}

export async function deleteTier(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) throw new Error('id 누락');
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('price_plan_tiers').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/plans');
}
