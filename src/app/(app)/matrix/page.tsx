import { getSupabaseAdmin } from '@/lib/supabase';
import { CARRIERS, type Carrier, formatKrw } from '@/lib/fmt';
import { MatrixControls } from './MatrixControls';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  carrier?: string;
  tier?: string;
  contract?: 'common' | 'select';
  activation?: 'new010' | 'mnp' | 'change';
}>;

const ACTIVATION_LABEL: Record<string, string> = { new010: '010신규', mnp: 'MNP', change: '기변/재가입' };
const CONTRACT_LABEL: Record<string, string> = { common: '공통(공시)', select: '선약' };

export default async function MatrixPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const carrier: Carrier = (CARRIERS as readonly string[]).includes(sp.carrier ?? '')
    ? (sp.carrier as Carrier)
    : 'SKT';
  const contract = sp.contract ?? 'common';
  const activation = sp.activation ?? 'mnp';

  const sb = getSupabaseAdmin();

  const [{ data: tiers }, { data: vendors }] = await Promise.all([
    sb
      .from('price_plan_tiers')
      .select('id, code, label, monthly_fee_krw, display_order')
      .eq('carrier', carrier)
      .eq('active', true)
      .order('display_order'),
    sb
      .from('price_vendors')
      .select('id, name, display_order')
      .eq('carrier', carrier)
      .eq('active', true)
      .order('display_order'),
  ]);

  const tierCode = sp.tier && (tiers ?? []).some((t) => t.code === sp.tier) ? sp.tier : tiers?.[0]?.code;

  const { data: rows } = await sb
    .from('price_latest_net')
    .select('vendor_id, vendor_name, device_id, device_name, device_code, device_series, retail_price_krw, plan_tier_code, contract_type, activation_type, vendor_price, subsidy_krw, net_price')
    .eq('carrier', carrier)
    .eq('contract_type', contract)
    .eq('activation_type', activation)
    .eq('plan_tier_code', tierCode ?? '')
    .order('device_name');

  // device_id별 집계
  type Row = {
    device_id: string;
    device_name: string;
    device_code: string;
    retail_price_krw: number;
    series: string | null;
    byVendor: Record<string, { vendor: number; net: number; subsidy: number | null }>;
  };
  const map = new Map<string, Row>();
  for (const r of rows ?? []) {
    if (!map.has(r.device_id)) {
      map.set(r.device_id, {
        device_id: r.device_id,
        device_name: r.device_name,
        device_code: r.device_code,
        retail_price_krw: r.retail_price_krw,
        series: r.device_series,
        byVendor: {},
      });
    }
    map.get(r.device_id)!.byVendor[r.vendor_id] = {
      vendor: r.vendor_price,
      net: r.net_price,
      subsidy: r.subsidy_krw,
    };
  }
  const devices = Array.from(map.values()).sort((a, b) => {
    const s = (a.series ?? '').localeCompare(b.series ?? '');
    return s !== 0 ? s : a.device_name.localeCompare(b.device_name);
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Net가 매트릭스</h1>
        <p className="mt-1 text-sm text-zinc-500">
          출고가 − 공시지원금 − 거래처 단가 = <b>Net가</b> (마진 0 기준). 같은 통신사 거래처 2곳 비교, 최저가 하이라이트.
        </p>
      </header>

      <MatrixControls
        carrier={carrier}
        tier={tierCode ?? ''}
        contract={contract}
        activation={activation}
        tiers={tiers ?? []}
      />

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm">
          <span>
            <b>{carrier}</b> · {(tiers ?? []).find((t) => t.code === tierCode)?.label ?? ''} · {CONTRACT_LABEL[contract]} · {ACTIVATION_LABEL[activation]}
          </span>
          <span className="text-xs text-zinc-500">{devices.length} 모델 · {vendors?.length ?? 0} 거래처</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="sticky left-0 bg-zinc-50 px-3 py-2 text-left">모델</th>
                <th className="px-3 py-2 text-right">출고가</th>
                {(vendors ?? []).map((v) => (
                  <th key={v.id} className="border-l border-zinc-200 px-3 py-2 text-right">
                    {v.name} 단가
                  </th>
                ))}
                {(vendors ?? []).map((v) => (
                  <th key={`n-${v.id}`} className="border-l border-zinc-200 bg-emerald-50 px-3 py-2 text-right text-emerald-800">
                    {v.name} Net
                  </th>
                ))}
                <th className="border-l border-zinc-200 px-3 py-2 text-right">Δ</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={2 + (vendors?.length ?? 0) * 2 + 1} className="px-4 py-8 text-center text-zinc-400">
                    데이터 없음 — 단가표를 업로드하고 확정하세요.
                  </td>
                </tr>
              ) : null}
              {devices.map((d) => {
                const cells = (vendors ?? []).map((v) => d.byVendor[v.id]);
                const nets = cells.filter(Boolean).map((c) => c!.net);
                const minNet = nets.length ? Math.min(...nets) : null;
                const maxNet = nets.length ? Math.max(...nets) : null;
                const delta = nets.length > 1 ? maxNet! - minNet! : null;
                return (
                  <tr key={d.device_id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="sticky left-0 bg-white px-3 py-1.5">
                      <div className="font-medium">{d.device_name}</div>
                      <div className="font-mono text-[10px] text-zinc-400">{d.device_code}</div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-zinc-500">{formatKrw(d.retail_price_krw)}</td>
                    {cells.map((c, i) => (
                      <td key={`v-${i}`} className="border-l border-zinc-100 px-3 py-1.5 text-right font-mono text-xs">
                        {c ? formatKrw(c.vendor) : <span className="text-zinc-300">—</span>}
                      </td>
                    ))}
                    {cells.map((c, i) => (
                      <td
                        key={`n-${i}`}
                        className={`border-l border-zinc-100 px-3 py-1.5 text-right font-mono font-semibold ${
                          c && c.net === minNet ? 'bg-emerald-50 text-emerald-700' : ''
                        }`}
                      >
                        {c ? formatKrw(c.net) : <span className="text-zinc-300">—</span>}
                      </td>
                    ))}
                    <td className="border-l border-zinc-100 px-3 py-1.5 text-right font-mono text-xs">
                      {delta != null ? (delta === 0 ? '0' : formatKrw(delta)) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
