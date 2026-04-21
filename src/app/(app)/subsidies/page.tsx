import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SubsidyTable } from './SubsidyTable';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ carrier?: 'SKT' | 'KT' | 'LGU+' }>;

const CARRIERS = ['SKT', 'KT', 'LGU+'] as const;

export default async function SubsidiesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const carrier = sp.carrier ?? 'SKT';
  const sb = getSupabaseAdmin();

  const [{ data: devices }, { data: tiers }, { data: subsidies }] = await Promise.all([
    sb.from('price_devices').select('id, model_code, nickname, series, retail_price_krw, display_order, active').eq('active', true).order('display_order').order('nickname'),
    sb.from('price_plan_tiers').select('id, code, label, display_order').eq('carrier', carrier).eq('active', true).order('display_order'),
    sb.from('price_carrier_subsidies').select('id, device_id, plan_tier_id, subsidy_krw, updated_at, source_vendor_id').eq('carrier', carrier),
  ]);

  const bundle = {
    devices: devices ?? [],
    tiers: tiers ?? [],
    subsidies: subsidies ?? [],
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">공시지원금 (통신사별)</h1>
          <p className="mt-1 text-sm text-zinc-500">통신사 × 모델 × 요금제 구간 단위. 셀 클릭하여 편집 (단위: 천원 · 예: 500 = 500,000원)</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm">
          {CARRIERS.map((c) => (
            <Link
              key={c}
              href={`/subsidies?carrier=${encodeURIComponent(c)}`}
              className={`rounded px-3 py-1.5 ${c === carrier ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              {c}
            </Link>
          ))}
        </div>
      </header>

      <SubsidyTable carrier={carrier} bundle={bundle} />
    </div>
  );
}
