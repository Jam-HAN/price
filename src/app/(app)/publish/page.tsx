import { getSupabaseAdmin } from '@/lib/supabase';
import type { Carrier } from '@/lib/fmt';
import { PublishControls } from './PublishControls';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ tierSKT?: string; tierKT?: string; tierLGU?: string; contract?: 'common' | 'select' }>;

const SERIES_SECTIONS: { key: string; label: string; series: string[] }[] = [
  { key: 'fold7', label: 'SAMSUNG 폴더블 7', series: ['fold7', 'flip7'] },
  { key: 's26', label: 'SAMSUNG S26', series: ['galaxyS26'] },
  { key: 'iphone17', label: 'Apple iPhone 17', series: ['iphone17', 'iphoneAir'] },
  { key: 's25', label: 'SAMSUNG S25', series: ['galaxyS25'] },
  { key: 'iphone16', label: 'Apple iPhone 16', series: ['iphone16'] },
  { key: 'other', label: '기타', series: ['galaxyEtc', 'fold6', 'flip6', 'iphone15', 'tablet', 'wearable', 'misc'] },
];

export default async function PublishPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const contract = sp.contract ?? 'common';

  const sb = getSupabaseAdmin();
  const [{ data: tiersAll }] = await Promise.all([
    sb.from('price_plan_tiers').select('id, carrier, code, label, monthly_fee_krw, display_order').eq('active', true).order('carrier').order('display_order'),
  ]);

  const byCarrier = new Map<Carrier, typeof tiersAll>();
  for (const c of ['SKT', 'KT', 'LGU+'] as Carrier[]) byCarrier.set(c, []);
  for (const t of tiersAll ?? []) byCarrier.get(t.carrier as Carrier)?.push(t);

  const tierSKT = sp.tierSKT ?? byCarrier.get('SKT')?.[1]?.code ?? 'I_100'; // BASE 다음 = I_100
  const tierKT = sp.tierKT ?? byCarrier.get('KT')?.[0]?.code ?? 'T110';
  const tierLGU = sp.tierLGU ?? byCarrier.get('LGU+')?.[0]?.code ?? 'G115';

  const { data: rows } = await sb
    .from('price_latest_net')
    .select('vendor_id, vendor_name, carrier, device_id, device_name, device_code, device_series, retail_price_krw, plan_tier_code, contract_type, activation_type, net_price')
    .in('carrier', ['SKT', 'KT', 'LGU+'])
    .eq('contract_type', contract)
    .in('activation_type', ['mnp', 'change'])
    .or(`plan_tier_code.eq.${tierSKT},plan_tier_code.eq.${tierKT},plan_tier_code.eq.${tierLGU}`)
    .order('device_name');

  // 각 (device, carrier, activation) 별로 최저 Net가만 유지
  type CarrierKey = { mnp?: number; change?: number };
  type DeviceAgg = {
    device_id: string;
    name: string;
    code: string;
    series: string | null;
    retail: number;
    skt: CarrierKey;
    kt: CarrierKey;
    lgu: CarrierKey;
  };
  const agg = new Map<string, DeviceAgg>();
  for (const r of rows ?? []) {
    const matchesTier =
      (r.carrier === 'SKT' && r.plan_tier_code === tierSKT) ||
      (r.carrier === 'KT' && r.plan_tier_code === tierKT) ||
      (r.carrier === 'LGU+' && r.plan_tier_code === tierLGU);
    if (!matchesTier) continue;
    if (!agg.has(r.device_id)) {
      agg.set(r.device_id, {
        device_id: r.device_id,
        name: r.device_name,
        code: r.device_code,
        series: r.device_series,
        retail: r.retail_price_krw,
        skt: {},
        kt: {},
        lgu: {},
      });
    }
    const d = agg.get(r.device_id)!;
    const carrierKey = r.carrier === 'SKT' ? d.skt : r.carrier === 'KT' ? d.kt : d.lgu;
    const actKey = r.activation_type as 'mnp' | 'change';
    const cur = carrierKey[actKey];
    if (cur == null || r.net_price < cur) carrierKey[actKey] = r.net_price;
  }
  const devices = Array.from(agg.values());

  const sections = SERIES_SECTIONS.map((s) => ({
    ...s,
    rows: devices
      .filter((d) => s.series.includes(d.series ?? 'misc'))
      .sort((a, b) => a.retail - b.retail),
  })).filter((s) => s.rows.length > 0);

  const tierLabel = (carrier: Carrier, code: string) => (byCarrier.get(carrier) ?? []).find((t) => t.code === code);
  const skt = tierLabel('SKT', tierSKT);
  const kt = tierLabel('KT', tierKT);
  const lgu = tierLabel('LGU+', tierLGU);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">고객용 단가표 (Net가)</h1>
        <p className="mt-1 text-sm text-zinc-500">
          같은 통신사 2곳 중 더 싼 Net가 자동 선택 · 만원 단위 · 마진 0 기준
        </p>
      </header>

      <PublishControls
        contract={contract}
        tiers={{ SKT: byCarrier.get('SKT') ?? [], KT: byCarrier.get('KT') ?? [], 'LGU+': byCarrier.get('LGU+') ?? [] }}
        selected={{ SKT: tierSKT, KT: tierKT, 'LGU+': tierLGU }}
      />

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b-4 border-sky-900 px-6 py-4">
          <div className="text-center text-2xl font-black tracking-tight text-sky-900">대박통신</div>
          <div className="mt-1 text-center text-xs text-zinc-500">대한민국 대표 휴대폰 성지</div>
          <div className="mt-3 rounded-lg bg-sky-900 px-3 py-2 text-center text-sm font-bold text-white">
            정직하게 거래하는 휴대폰 성지 — 가격·정책·설명 모두 투명 공개
          </div>
        </div>

        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-3 text-[13px] text-zinc-700">
          <p>· 시세 금액은 <b>Net가(원)</b> — 출고가 − 공시지원금 − 단가(마진 0). 실제 구매가는 지원금·약정 정책에 따라 조정.</p>
          <p>· 요금제 사용 기간: 공시 6개월(185일) / 선택 4개월(130일)</p>
          <p>· 시세표 금액은 공시 지원금 기준이며, 선택약정 희망 시 별도 문의.</p>
        </div>

        <div className="px-6 py-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50">
                <th className="w-[32%] border border-zinc-200 px-2 py-2 text-center font-bold">통신사</th>
                <th className="w-[22%] border border-zinc-200 px-2 py-2 text-center">SKT</th>
                <th className="w-[23%] border border-zinc-200 px-2 py-2 text-center">KT</th>
                <th className="w-[23%] border border-zinc-200 px-2 py-2 text-center">LGU+</th>
              </tr>
              <tr>
                <th className="border border-zinc-200 px-2 py-2 text-center font-bold">요금제</th>
                <TierHeader tier={skt} />
                <TierHeader tier={kt} />
                <TierHeader tier={lgu} />
              </tr>
            </thead>
          </table>
        </div>

        {sections.map((s) => (
          <section key={s.key} className="px-6 pb-4">
            <h2 className="my-3 rounded-lg border-2 border-sky-900 px-3 py-2 text-sm font-black text-sky-900">
              {s.label}
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zinc-50 text-xs">
                  <th className="w-[32%] border border-zinc-200 px-2 py-2 text-left">모델</th>
                  {(['skt', 'kt', 'lgu'] as const).map((c) => (
                    <>
                      <th key={`${c}-m`} className="w-[11%] border border-zinc-200 px-2 py-2 text-center">
                        {c.toUpperCase()} 이동
                      </th>
                      <th key={`${c}-c`} className="w-[11%] border border-zinc-200 px-2 py-2 text-center">
                        {c.toUpperCase()} 기변
                      </th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((d) => (
                  <tr key={d.device_id}>
                    <td className="border border-zinc-200 px-2 py-1.5 font-semibold">{d.name}</td>
                    <PriceCell v={d.skt.mnp} />
                    <PriceCell v={d.skt.change} />
                    <PriceCell v={d.kt.mnp} />
                    <PriceCell v={d.kt.change} />
                    <PriceCell v={d.lgu.mnp} />
                    <PriceCell v={d.lgu.change} />
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <div className="mx-6 my-4 rounded-xl bg-gradient-to-r from-sky-800 to-sky-600 px-4 py-5 text-center text-white">
          <h3 className="text-lg font-black">인터넷 + TV + 휴대폰 최대 100만 지원!!</h3>
          <p className="text-sm">SK 80 · KT 80 · LG 100</p>
        </div>

        <div className="mx-6 mb-4 space-y-2">
          <div className="rounded-lg border border-zinc-200 p-3 text-xs text-zinc-700">
            <b className="text-sky-900">SKT</b> — T ALL 케어 + 마이스마트플러스 + 우주패스 + WAVE / M(망월) 제외 + 3개월 유지
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 text-xs text-zinc-700">
            <b className="text-sky-900">KT</b> — 필수팩 L1 또는 L2 + 보험 + 디즈니+(스탠다드) / M(망월) 제외 + 3개월 유지
          </div>
          <div className="rounded-lg border border-zinc-200 p-3 text-xs text-zinc-700">
            <b className="text-sky-900">LGU+</b> — 모두팩 + 유플에이 + 포켓피스 + 듀얼넘버+ / 당월 포함 + 100일 유지
          </div>
        </div>

        <footer className="px-6 py-4 text-center text-xs text-zinc-500">ⓒ 대박통신 · 매장 안내용</footer>
      </section>
    </div>
  );
}

function TierHeader({ tier }: { tier?: { label: string; monthly_fee_krw: number | null } | null }) {
  return (
    <th className="border border-zinc-200 px-2 py-2 text-center">
      {tier ? (
        <div>
          <div className="font-bold">{tier.label.split(' ')[0]}</div>
          {tier.monthly_fee_krw ? (
            <div className="text-xs font-normal text-zinc-500">({new Intl.NumberFormat('ko-KR').format(tier.monthly_fee_krw)}원)</div>
          ) : null}
        </div>
      ) : (
        <span className="text-zinc-400">—</span>
      )}
    </th>
  );
}

function PriceCell({ v }: { v?: number | null }) {
  if (v == null) return <td className="border border-zinc-200 px-2 py-1.5 text-center text-zinc-300">—</td>;
  const man = v / 10000;
  const neg = man < 0;
  const low = !neg && man < 30;
  return (
    <td
      className={`border border-zinc-200 px-2 py-1.5 text-center font-black ${
        neg ? 'text-red-600' : low ? 'text-red-500' : 'text-zinc-900'
      }`}
    >
      {Math.round(man)}
    </td>
  );
}
