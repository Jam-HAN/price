import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatMan, compareDevicesForList } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ carrier?: 'SKT' | 'KT' | 'LGU+'; contract?: 'common' | 'select' }>;

const CARRIERS = ['SKT', 'KT', 'LGU+'] as const;
const CONTRACTS = [
  { v: 'common', label: '공통지원금' },
  { v: 'select', label: '선택약정' },
] as const;
const ACTIVATIONS = [
  { v: 'new010', label: '010' },
  { v: 'mnp', label: 'MNP' },
  { v: 'change', label: '기변' },
] as const;

type NetRow = {
  device_id: string;
  device_name: string;
  device_code: string;
  device_order: number;
  device_series: string | null;
  device_storage: string | null;
  retail_price_krw: number;
  plan_tier_code: string;
  tier_order: number;
  vendor_name: string;
  contract_type: 'common' | 'select';
  activation_type: 'new010' | 'mnp' | 'change';
  net_price: number;
};

export default async function MatrixPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const carrier = sp.carrier ?? 'SKT';
  const contract = sp.contract ?? 'common';
  const sb = getSupabaseAdmin();

  const [{ data: tiers }, { data: rows }] = await Promise.all([
    sb.from('price_plan_tiers').select('id, code, display_order').eq('carrier', carrier).eq('active', true).order('display_order'),
    sb.from('price_latest_net').select('device_id, device_name, device_code, device_order, device_series, device_storage, retail_price_krw, plan_tier_code, tier_order, vendor_name, contract_type, activation_type, net_price')
      .eq('carrier', carrier).eq('contract_type', contract),
  ]);

  const tierCodes = (tiers ?? []).map((t) => t.code);

  // 디바이스 × tier × activation 조합별 최저 Net 뽑기
  const cellBest = new Map<string, { price: number; vendor: string }>();
  const deviceMap = new Map<string, { name: string; code: string; order: number; retail: number; series: string | null; storage: string | null }>();

  for (const r of (rows ?? []) as NetRow[]) {
    if (!deviceMap.has(r.device_id)) {
      deviceMap.set(r.device_id, {
        name: r.device_name, code: r.device_code, order: r.device_order,
        retail: r.retail_price_krw, series: r.device_series, storage: r.device_storage,
      });
    }
    const key = `${r.device_id}|${r.plan_tier_code}|${r.activation_type}`;
    const current = cellBest.get(key);
    if (!current || r.net_price < current.price) {
      cellBest.set(key, { price: r.net_price, vendor: r.vendor_name });
    }
  }

  const devices = Array.from(deviceMap.entries())
    .map(([id, d]) => ({
      id,
      ...d,
      retail_price_krw: d.retail,
      nickname: d.name,
      model_code: d.code,
    }))
    .sort(compareDevicesForList);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Net가 매트릭스</h1>
          <p className="mt-1 text-sm text-zinc-500">
            통신사별 전체 요금제 × 개통유형. 값은 만원 단위 (예: 15.5 = 15만5천원). 거래처 중 최저 Net 표시, 셀 hover로 거래처 확인.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm">
            {CARRIERS.map((c) => (
              <Link key={c} href={`/matrix?carrier=${c}&contract=${contract}`}
                className={`rounded px-3 py-1.5 ${c === carrier ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                {c}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-sm">
            {CONTRACTS.map((c) => (
              <Link key={c.v} href={`/matrix?carrier=${carrier}&contract=${c.v}`}
                className={`rounded px-3 py-1.5 ${c.v === contract ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th rowSpan={2} className="sticky left-0 bg-zinc-50 px-3 py-2 text-left">모델</th>
              <th rowSpan={2} className="px-2 py-2 text-right">출고가</th>
              {tierCodes.map((code) => (
                <th key={code} colSpan={ACTIVATIONS.length} className="border-l border-zinc-200 px-2 py-1 text-center">
                  {code}
                </th>
              ))}
            </tr>
            <tr>
              {tierCodes.map((code) =>
                ACTIVATIONS.map((a) => (
                  <th key={`${code}-${a.v}`} className={`px-1 py-1 text-[10px] font-normal ${a.v === 'new010' ? 'border-l border-zinc-200' : ''}`}>
                    {a.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-t border-zinc-100">
                <td className="sticky left-0 bg-white px-3 py-1.5 font-medium">
                  <div>{d.name}</div>
                  <div className="font-mono text-[10px] text-zinc-400">{d.code}</div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-500">
                  {formatMan(d.retail)}
                </td>
                {tierCodes.map((code) =>
                  ACTIVATIONS.map((a) => {
                    const cell = cellBest.get(`${d.id}|${code}|${a.v}`);
                    const leftBorder = a.v === 'new010' ? 'border-l border-zinc-200' : '';
                    if (!cell) return (
                      <td key={`${code}-${a.v}`} className={`px-1 py-1 text-center text-zinc-300 ${leftBorder}`}>—</td>
                    );
                    const neg = cell.price < 0;
                    return (
                      <td key={`${code}-${a.v}`} title={`거래처: ${cell.vendor}`}
                        className={`px-1 py-1 text-right font-mono ${neg ? 'text-red-600 font-semibold' : 'text-zinc-900'} ${leftBorder}`}>
                        {formatMan(cell.price)}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
