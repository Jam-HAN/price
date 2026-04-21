import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { compareDevicesForList } from '@/lib/fmt';
import { SubsidyTable } from './SubsidyTable';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ carrier?: 'SKT' | 'KT' | 'LGU+' }>;

const CARRIERS = ['SKT', 'KT', 'LGU+'] as const;

export default async function SubsidiesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const carrier = sp.carrier ?? 'SKT';
  const sb = getSupabaseAdmin();

  const [{ data: devices }, { data: tiers }, { data: subsidies }] = await Promise.all([
    sb.from('price_devices').select('id, model_code, nickname, manufacturer, series, storage, retail_price_krw, display_order, active').eq('active', true),
    sb.from('price_plan_tiers').select('id, code, label, display_order').eq('carrier', carrier).eq('active', true).order('display_order'),
    sb.from('price_carrier_subsidies').select('id, device_id, plan_tier_id, subsidy_krw, updated_at, source_vendor_id').eq('carrier', carrier),
  ]);

  const sortedDevices = [...(devices ?? [])].sort(compareDevicesForList);

  const bundle = {
    devices: sortedDevices,
    tiers: tiers ?? [],
    subsidies: subsidies ?? [],
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="page-title">공통지원금</h1>
        <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 text-xs">
          {CARRIERS.map((c) => (
            <Link
              key={c}
              href={`/subsidies?carrier=${encodeURIComponent(c)}`}
              className={`rounded-full px-4 py-1 ${c === carrier ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
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
