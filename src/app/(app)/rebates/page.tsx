import { getSupabaseAdmin } from '@/lib/supabase';
import { compareDevicesForList } from '@/lib/fmt';
import { PageHeader, SegmentedLink, type CarrierKey } from '@/components/ui';
import { RebateTable } from './RebateTable';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ carrier?: 'SKT' | 'KT' | 'LGU+' }>;

const CARRIERS = ['SKT', 'KT', 'LGU+'] as const;

export default async function RebatesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const carrier = sp.carrier ?? 'SKT';
  const sb = getSupabaseAdmin();

  const [{ data: vendors }, { data: tiers }, { data: devices }] = await Promise.all([
    sb.from('price_vendors').select('id, name').eq('carrier', carrier).eq('active', true).order('display_order').order('name'),
    sb.from('price_plan_tiers').select('id, code, display_order').eq('carrier', carrier).eq('active', true).order('display_order'),
    sb.from('price_devices').select('id, model_code, nickname, manufacturer, series, storage, retail_price_krw, display_order').eq('active', true),
  ]);

  // 각 거래처의 최신 시트만 리베이트 조회
  const vendorIds = (vendors ?? []).map((v) => v.id);
  const { data: latestSheets } = vendorIds.length
    ? await sb
        .from('price_vendor_quote_sheets')
        .select('id, vendor_id, effective_date')
        .in('vendor_id', vendorIds)
        .eq('parse_status', 'confirmed')
        .order('effective_date', { ascending: false })
    : { data: [] as { id: string; vendor_id: string; effective_date: string }[] };

  const latestSheetByVendor = new Map<string, string>();
  for (const s of latestSheets ?? []) {
    if (!latestSheetByVendor.has(s.vendor_id)) latestSheetByVendor.set(s.vendor_id, s.id);
  }
  const sheetIds = Array.from(latestSheetByVendor.values());

  const { data: rebates } = sheetIds.length
    ? await sb
        .from('price_vendor_quotes')
        .select('sheet_id, device_id, plan_tier_id, contract_type, activation_type, amount_krw')
        .in('sheet_id', sheetIds)
    : { data: [] as { sheet_id: string; device_id: string; plan_tier_id: string; contract_type: 'common' | 'select'; activation_type: 'new010' | 'mnp' | 'change'; amount_krw: number }[] };

  return (
    <>
      <PageHeader
        crumbs={['대박통신', '가격', '리베이트']}
        title="리베이트 (거래처)"
        actions={
          <SegmentedLink
            value={carrier}
            options={CARRIERS.map((c) => ({ v: c as CarrierKey, label: c }))}
            hrefFor={(c) => `/rebates?carrier=${encodeURIComponent(c)}`}
          />
        }
      />
      <RebateTable
        carrier={carrier}
        vendors={vendors ?? []}
        tiers={tiers ?? []}
        devices={[...(devices ?? [])].sort(compareDevicesForList)}
        rebates={rebates ?? []}
        latestSheetByVendor={Object.fromEntries(latestSheetByVendor)}
      />
    </>
  );
}
