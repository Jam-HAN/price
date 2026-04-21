import { getSupabaseAdmin } from '@/lib/supabase';
import { formatMan, compareDevicesForList } from '@/lib/fmt';
import { PageHeader, SegmentedLink, type CarrierKey } from '@/components/ui';

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
    <>
      <PageHeader
        crumbs={['대박통신', '가격', 'Net가']}
        title="Net가 매트릭스"
        actions={
          <div className="flex gap-2">
            <SegmentedLink
              value={carrier}
              options={CARRIERS.map((c) => ({ v: c as CarrierKey, label: c }))}
              hrefFor={(c) => `/matrix?carrier=${c}&contract=${contract}`}
            />
            <SegmentedLink
              value={contract}
              options={CONTRACTS.map((c) => ({ v: c.v, label: c.label }))}
              hrefFor={(c) => `/matrix?carrier=${carrier}&contract=${c}`}
            />
          </div>
        }
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: '#fafbff', color: 'var(--ink-3)', borderBottom: '1px solid var(--line)' }}
                >
                  모델
                </th>
                <th
                  rowSpan={2}
                  className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: '#fafbff', color: 'var(--ink-3)', borderBottom: '1px solid var(--line)' }}
                >
                  출고가
                </th>
                {tierCodes.map((code) => (
                  <th
                    key={code}
                    colSpan={ACTIVATIONS.length}
                    className="px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wider"
                    style={{ background: '#fafbff', color: 'var(--ink-3)', borderLeft: '1px solid var(--line)' }}
                  >
                    {code}
                  </th>
                ))}
              </tr>
              <tr>
                {tierCodes.map((code) =>
                  ACTIVATIONS.map((a) => (
                    <th
                      key={`${code}-${a.v}`}
                      className="px-1.5 py-1.5 text-center text-[10px] font-normal"
                      style={{
                        background: '#fafbff',
                        color: 'var(--ink-3)',
                        borderBottom: '1px solid var(--line)',
                        borderLeft: a.v === 'new010' ? '1px solid var(--line)' : 'none',
                      }}
                    >
                      {a.label}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={2 + tierCodes.length * ACTIVATIONS.length} className="py-16 text-center" style={{ color: 'var(--ink-3)' }}>
                    데이터가 없습니다. 단가표 업로드 후 확인해주세요.
                  </td>
                </tr>
              ) : null}
              {devices.map((d) => (
                <tr key={d.id} style={{ borderTop: '1px solid var(--line-2)' }}>
                  <td className="sticky left-0 bg-white px-4 py-2">
                    <div className="text-[13px] font-semibold">{d.name}</div>
                    <div className="mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
                      {d.code}
                    </div>
                  </td>
                  <td className="mono px-3 py-2 text-right text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {formatMan(d.retail)}
                  </td>
                  {tierCodes.map((code) =>
                    ACTIVATIONS.map((a) => {
                      const cell = cellBest.get(`${d.id}|${code}|${a.v}`);
                      const leftBorder = a.v === 'new010' ? '1px solid var(--line)' : 'none';
                      if (!cell)
                        return (
                          <td
                            key={`${code}-${a.v}`}
                            className="px-1.5 py-2 text-center"
                            style={{ color: 'var(--ink-3)', borderLeft: leftBorder }}
                          >
                            —
                          </td>
                        );
                      const neg = cell.price < 0;
                      return (
                        <td
                          key={`${code}-${a.v}`}
                          title={`거래처: ${cell.vendor}`}
                          className="mono px-1.5 py-2 text-right"
                          style={{
                            borderLeft: leftBorder,
                            color: neg ? 'var(--red)' : 'var(--ink)',
                            fontWeight: neg ? 700 : 500,
                          }}
                        >
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
    </>
  );
}
