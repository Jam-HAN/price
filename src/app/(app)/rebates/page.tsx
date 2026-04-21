import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { compareDevicesForList } from '@/lib/fmt';
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
    sb.from('price_devices').select('id, model_code, nickname, manufacturer, retail_price_krw, display_order').eq('active', true),
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
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">리베이트 (거래처별)</h1>
          <p className="mt-1 text-sm text-zinc-500">거래처별 최신 단가표의 리베이트. 단위: 만원 (15.5 = 15만5천원)</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm">
          {CARRIERS.map((c) => (
            <Link
              key={c}
              href={`/rebates?carrier=${encodeURIComponent(c)}`}
              className={`rounded px-3 py-1.5 ${c === carrier ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              {c}
            </Link>
          ))}
        </div>
      </header>

      <RebateTable
        carrier={carrier}
        vendors={vendors ?? []}
        tiers={tiers ?? []}
        devices={[...(devices ?? [])].sort(compareDevicesForList)}
        rebates={rebates ?? []}
        latestSheetByVendor={Object.fromEntries(latestSheetByVendor)}
      />
    </div>
  );
}
