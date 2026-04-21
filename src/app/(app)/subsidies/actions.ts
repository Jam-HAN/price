'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function updateCarrierSubsidy(input: {
  carrier: 'SKT' | 'KT' | 'LGU+';
  device_id: string;
  plan_tier_id: string;
  subsidy_krw: number | null;
}) {
  const sb = getSupabaseAdmin();
  if (input.subsidy_krw == null) {
    const { error } = await sb
      .from('price_carrier_subsidies')
      .delete()
      .match({ carrier: input.carrier, device_id: input.device_id, plan_tier_id: input.plan_tier_id });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await sb.from('price_carrier_subsidies').upsert(
      {
        carrier: input.carrier,
        device_id: input.device_id,
        plan_tier_id: input.plan_tier_id,
        subsidy_krw: input.subsidy_krw,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'carrier,device_id,plan_tier_id' },
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath('/subsidies');
  revalidatePath('/matrix');
  revalidatePath('/publish');
  return { ok: true };
}
