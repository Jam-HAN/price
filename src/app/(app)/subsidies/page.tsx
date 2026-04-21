import { getSupabaseAdmin } from '@/lib/supabase';
import { compareDevicesForList } from '@/lib/fmt';
import { PageHeader, SegmentedLink, type CarrierKey } from '@/components/ui';
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
    <>
      <PageHeader
        crumbs={['대박통신', '가격', '공통지원금']}
        title="공통지원금"
        actions={
          <SegmentedLink
            value={carrier}
            options={CARRIERS.map((c) => ({ v: c as CarrierKey, label: c }))}
            hrefFor={(c) => `/subsidies?carrier=${encodeURIComponent(c)}`}
          />
        }
      />
      <SubsidyTable carrier={carrier} bundle={bundle} />
    </>
  );
}
