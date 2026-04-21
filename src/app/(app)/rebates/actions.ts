'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function updateRebate(input: {
  sheet_id: string;
  device_id: string;
  plan_tier_id: string;
  contract_type: 'common' | 'select';
  activation_type: 'new010' | 'mnp' | 'change';
  amount_krw: number | null;
}) {
  const sb = getSupabaseAdmin();
  const match = {
    sheet_id: input.sheet_id,
    device_id: input.device_id,
    plan_tier_id: input.plan_tier_id,
    contract_type: input.contract_type,
    activation_type: input.activation_type,
  };
  if (input.amount_krw == null) {
    const { error } = await sb.from('price_vendor_quotes').delete().match(match);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb
      .from('price_vendor_quotes')
      .upsert({ ...match, amount_krw: input.amount_krw }, { onConflict: 'sheet_id,device_id,plan_tier_id,contract_type,activation_type' });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/rebates');
  revalidatePath('/matrix');
  revalidatePath('/publish');
  return { ok: true };
}
