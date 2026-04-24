import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { type Carrier, compareDevicesForList, formatKrw, formatMan, kstToday } from '@/lib/fmt';
import { PageHeader, CarrierPill, Chip, SegmentedLink, type CarrierKey } from '@/components/ui';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{
  mode?: 'net' | 'cust';
  carrier?: CarrierKey;
  contract?: 'common' | 'select';
  tier?: string;
}>;

const CARRIERS: CarrierKey[] = ['SKT', 'KT', 'LGU+'];

// 핸드오프의 sheet.net / sheet.cust 템플릿을 렌더링.
// 데이터: price_customer_view — 디바이스 × 통신사 × 구간 × (공통/선약) × (010/MNP/기변) × net/margin/customer_price

const formatKRW = formatKrw; // publish 시트는 숫자만 (단위 접미사 없음)

export default async function PublishPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const mode = sp.mode ?? 'cust';
  const carrier = (sp.carrier ?? 'SKT') as CarrierKey;
  const contract = sp.contract ?? 'common';

  const sb = getSupabaseAdmin();
  const [{ data: tiers }, { data: rows }, { data: deviceList }] = await Promise.all([
    sb
      .from('price_plan_tiers')
      .select('id, code, label, monthly_fee_krw, display_order')
      .eq('carrier', carrier)
      .eq('active', true)
      .order('display_order'),
    sb
      .from('price_customer_view')
      .select(
        'vendor_id, vendor_name, carrier, device_id, device_name, device_code, device_series, device_storage, retail_price_krw, plan_tier_code, plan_tier_label, contract_type, activation_type, net_price, subsidy_krw, vendor_price, margin_krw, customer_price',
      )
      .eq('carrier', carrier)
      .eq('contract_type', contract),
    sb
      .from('price_devices')
      .select('id, model_code, nickname, series, storage, retail_price_krw, display_order')
      .eq('active', true),
  ]);

  // 디바이스별 tier × activation 집계, 최저 Net가 기준
  type Cell = { net: number; margin: number; customer: number; subsidy: number; rebate: number; vendor: string };
  type DeviceAgg = {
    id: string;
    name: string;
    code: string;
    series: string | null;
    storage: string | null;
    retail: number;
    byTierAct: Map<string, Cell>; // key = `${tier}|${activation}`
  };
  // 활성 device 전체를 기준 행으로 초기화 (quotes 0건인 모델도 행은 노출)
  const agg = new Map<string, DeviceAgg>();
  for (const d of deviceList ?? []) {
    agg.set(d.id, {
      id: d.id,
      name: d.nickname,
      code: d.model_code,
      series: d.series,
      storage: d.storage,
      retail: d.retail_price_krw,
      byTierAct: new Map(),
    });
  }
  for (const r of rows ?? []) {
    const d = agg.get(r.device_id);
    if (!d) continue; // inactive / deleted device는 무시
    const key = `${r.plan_tier_code}|${r.activation_type}`;
    const cell: Cell = {
      net: r.net_price,
      margin: r.margin_krw ?? 0,
      customer: r.customer_price ?? r.net_price,
      subsidy: r.subsidy_krw ?? 0,
      rebate: r.vendor_price ?? 0,
      vendor: r.vendor_name,
    };
    const existing = d.byTierAct.get(key);
    if (!existing || cell.net < existing.net) d.byTierAct.set(key, cell);
  }
  const devices = Array.from(agg.values())
    .map((d) => ({ ...d, nickname: d.name, retail_price_krw: d.retail, model_code: d.code }))
    .sort(compareDevicesForList);

  return (
    <>
      <PageHeader
        crumbs={['대박통신', '단가표 출력']}
        title={mode === 'net' ? '넷가표 (내부용)' : '고객용 단가표'}
        actions={
          <>
            <button className="btn btn-ghost" onClick={undefined}>
              인쇄
            </button>
            <button className="btn btn-primary" onClick={undefined}>
              공유 링크 복사
            </button>
          </>
        }
      />

      {/* 컨트롤 바 */}
      <div className="card mb-4 flex flex-wrap items-center gap-3.5 p-3.5">
        <div className="seg">
          <a
            href={`?mode=net&carrier=${carrier}&contract=${contract}`}
            className={mode === 'net' ? 'on' : ''}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: mode === 'net' ? 'var(--ink)' : 'var(--ink-3)',
              background: mode === 'net' ? '#fff' : 'transparent',
              boxShadow: mode === 'net' ? '0 1px 2px rgba(11,16,32,0.08)' : 'none',
            }}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: 'var(--ink)' }} />
            넷가표
          </a>
          <a
            href={`?mode=cust&carrier=${carrier}&contract=${contract}`}
            className={mode === 'cust' ? 'on' : ''}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: mode === 'cust' ? 'var(--ink)' : 'var(--ink-3)',
              background: mode === 'cust' ? '#fff' : 'transparent',
              boxShadow: mode === 'cust' ? '0 1px 2px rgba(11,16,32,0.08)' : 'none',
            }}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: 'var(--blue)' }} />
            고객용
          </a>
        </div>

        <div className="h-7 border-l" style={{ borderColor: 'var(--line)' }} />

        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--ink-3)' }}>
            통신사
          </span>
          <SegmentedLink
            value={carrier}
            options={CARRIERS.map((c) => ({ v: c, label: c }))}
            hrefFor={(c) => `?mode=${mode}&carrier=${encodeURIComponent(c)}&contract=${contract}`}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--ink-3)' }}>
            약정
          </span>
          <SegmentedLink
            value={contract}
            options={[
              { v: 'common' as const, label: '공통' },
              { v: 'select' as const, label: '선약' },
            ]}
            hrefFor={(c) => `?mode=${mode}&carrier=${carrier}&contract=${c}`}
          />
        </div>

        <span className="ml-auto text-[12px]" style={{ color: 'var(--ink-3)' }}>
          실시간 미리보기
        </span>
      </div>

      {/* 시트 */}
      {mode === 'net' ? (
        <NetSheet devices={devices} tiers={tiers ?? []} carrier={carrier} contract={contract} />
      ) : (
        <CustSheet devices={devices} tiers={tiers ?? []} carrier={carrier} contract={contract} />
      )}
    </>
  );
}

type TierRow = { id: string; code: string; label: string; monthly_fee_krw: number | null };
type DeviceRow = {
  id: string;
  name: string;
  code: string;
  storage: string | null;
  retail: number;
  byTierAct: Map<string, { net: number; margin: number; customer: number; subsidy: number; rebate: number; vendor: string }>;
};

function NetSheet({
  devices,
  tiers,
  carrier,
  contract,
}: {
  devices: DeviceRow[];
  tiers: TierRow[];
  carrier: CarrierKey;
  contract: 'common' | 'select';
}) {
  // 요약 계산 — 전체 mnp 조합 기준 평균
  const allCells = devices.flatMap((d) =>
    tiers.flatMap((t) => {
      const c = d.byTierAct.get(`${t.code}|mnp`);
      return c ? [{ net: c.net, margin: c.margin }] : [];
    }),
  );
  const avgNet = allCells.length ? Math.round(allCells.reduce((s, c) => s + c.net, 0) / allCells.length) : 0;
  const avgMargin = allCells.length ? Math.round(allCells.reduce((s, c) => s + c.margin, 0) / allCells.length) : 0;
  const today = kstToday();

  return (
    <div
      className="overflow-hidden rounded-[18px] border"
      style={{ background: '#fff', borderColor: 'var(--line)', boxShadow: 'var(--shadow-sheet)' }}
    >
      {/* 헤더 */}
      <div
        className="px-7 py-6 text-white"
        style={{ background: 'linear-gradient(135deg, #0b1020, #1c2452)' }}
      >
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Chip tone="ink">대외비</Chip>
              <span className="mono text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                NET-{today}-{carrier}-{contract.toUpperCase()}
              </span>
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.02em]">넷가표 · {carrier}</div>
            <div className="mt-1 text-[12px]" style={{ opacity: 0.75 }}>
              {contract === 'common' ? '공통지원금' : '선약'} · 대박통신 내부용 (원가·마진 포함)
            </div>
          </div>
          <div className="text-right text-[11px]" style={{ opacity: 0.8 }}>
            <div className="text-[18px] font-extrabold">대박통신</div>
            <div className="mono">{today} 발행</div>
            <div className="mt-1" style={{ color: 'var(--lime)' }}>
              총 {devices.length}개 모델 · {tiers.length}구간
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="px-7 pb-7 pt-6">
        {/* 요약 */}
        <div className="mb-5 grid grid-cols-4 gap-3">
          <div className="rounded-[10px] p-3" style={{ background: '#f5f7fb' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
              활성 모델
            </div>
            <div className="mono mt-0.5 text-[18px] font-extrabold">{devices.length}</div>
          </div>
          <div className="rounded-[10px] p-3" style={{ background: 'var(--pink-soft)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--pink)' }}>
              요금제 구간
            </div>
            <div className="mono mt-0.5 text-[18px] font-extrabold">{tiers.length}</div>
          </div>
          <div className="rounded-[10px] p-3" style={{ background: 'var(--blue-soft)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--blue-2)' }}>
              평균 Net (MNP)
            </div>
            <div className="mono mt-0.5 text-[18px] font-extrabold">₩{formatKRW(avgNet)}</div>
          </div>
          <div className="rounded-[10px] p-3" style={{ background: 'var(--lime-soft)' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#4f5d07' }}>
              평균 마진
            </div>
            <div className="mono mt-0.5 text-[18px] font-extrabold" style={{ color: 'var(--ok)' }}>
              ₩{formatKRW(avgMargin)}
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto">
          <table className="mono w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th
                  className="px-2 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  모델 / 구간
                </th>
                <th
                  className="px-2 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  출고가
                </th>
                <th
                  className="px-2 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  공통지원
                </th>
                <th
                  className="px-2 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  리베이트
                </th>
                <th
                  className="px-2 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  Net가
                </th>
                <th
                  className="px-2 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  마진
                </th>
                <th
                  className="px-2 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  거래처
                </th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center" style={{ color: 'var(--ink-3)' }}>
                    활성 모델이 없습니다. <Link href="/devices" className="underline">모델 설정</Link>에서 판매중 항목을 체크하세요.
                  </td>
                </tr>
              ) : null}
              {devices.map((d) => (
                <>
                  <tr key={`${d.id}-grp`}>
                    <td
                      colSpan={7}
                      className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider"
                      style={{ background: 'var(--ink)', color: 'var(--lime)' }}
                    >
                      ■ {d.name} ({d.storage ?? '—'}) · 출고가 ₩{formatKRW(d.retail)}
                    </td>
                  </tr>
                  {tiers.map((t) => {
                    const cell = d.byTierAct.get(`${t.code}|mnp`);
                    if (!cell) {
                      return (
                        <tr key={`${d.id}-${t.code}`}>
                          <td className="px-2 py-1.5 text-left font-semibold" style={{ borderBottom: '1px solid var(--line-2)' }}>
                            {t.label}
                          </td>
                          <td colSpan={6} className="px-2 py-1.5 text-center" style={{ color: 'var(--ink-3)', borderBottom: '1px solid var(--line-2)' }}>
                            데이터 없음
                          </td>
                        </tr>
                      );
                    }
                    const marginPos = cell.margin >= 0;
                    return (
                      <tr key={`${d.id}-${t.code}`}>
                        <td className="px-2 py-1.5 text-left font-semibold" style={{ borderBottom: '1px solid var(--line-2)' }}>
                          {t.label}
                        </td>
                        <td className="px-2 py-1.5 text-right" style={{ borderBottom: '1px solid var(--line-2)' }}>
                          {formatKRW(d.retail)}
                        </td>
                        <td className="px-2 py-1.5 text-right" style={{ borderBottom: '1px solid var(--line-2)' }}>
                          {formatKRW(cell.subsidy)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-bold" style={{ borderBottom: '1px solid var(--line-2)' }}>
                          {formatKRW(cell.rebate)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-bold" style={{ borderBottom: '1px solid var(--line-2)' }}>
                          {formatKRW(cell.net)}
                        </td>
                        <td
                          className="px-2 py-1.5 text-right font-bold"
                          style={{
                            borderBottom: '1px solid var(--line-2)',
                            color: marginPos ? 'var(--ok)' : 'var(--red)',
                          }}
                        >
                          {marginPos ? '+' : ''}
                          {formatKRW(cell.margin)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-[11px]" style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink-3)' }}>
                          {cell.vendor}
                        </td>
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 text-[11px]" style={{ color: 'var(--ink-3)' }}>
          ※ 본 문서는 대박통신 내부용이며 외부 공개 시 기밀 유지 위반입니다. Net = 출고가 − 공통지원 − 리베이트. 마진 = Net − (출고가 − 마진 설정).
        </div>
      </div>
    </div>
  );
}

function CustSheet({
  devices,
  tiers,
  carrier,
  contract,
}: {
  devices: DeviceRow[];
  tiers: TierRow[];
  carrier: CarrierKey;
  contract: 'common' | 'select';
}) {
  const today = kstToday();

  return (
    <div
      className="overflow-hidden rounded-[18px] border"
      style={{ background: '#fff', borderColor: 'var(--line)', boxShadow: 'var(--shadow-sheet)' }}
    >
      {/* 헤더 */}
      <div
        className="relative px-7 pb-9 pt-6 text-white"
        style={{ background: 'linear-gradient(135deg, #2152ff, #7a9bff)' }}
      >
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2.5">
              <div
                className="grid h-10 w-10 place-items-center rounded-[10px] font-extrabold"
                style={{ background: 'linear-gradient(135deg, #d4ff3f, #3fe0b0)', color: 'var(--ink)' }}
              >
                대
              </div>
              <div>
                <div className="text-[13px] font-bold">대박통신</div>
                <div className="text-[10px]" style={{ opacity: 0.8 }}>
                  대한민국 대표 성지
                </div>
              </div>
            </div>
            <div className="text-[22px] font-extrabold tracking-[-0.02em]">고객용 단가표 · {carrier}</div>
            <div className="mt-1 text-[12px]" style={{ opacity: 0.9 }}>
              {contract === 'common' ? '공통지원금 기준' : '선약 기준'} · 만원 단위 표기
            </div>
          </div>
          <div className="text-right text-[11px]" style={{ opacity: 0.9 }}>
            <div className="text-[18px] font-extrabold">{devices.length}개 모델</div>
            <div className="mono">{today}</div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="px-7 pb-7 pt-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                <th
                  className="px-2 py-2.5 text-left text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  모델
                </th>
                <th
                  className="px-2 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                  style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                >
                  출고가
                </th>
                {tiers.map((t) => (
                  <th
                    key={t.id}
                    className="px-2 py-2.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                    style={{ background: '#f5f7fb', color: 'var(--ink-2)', borderBottom: '2px solid var(--ink)' }}
                  >
                    {t.code}
                    {t.monthly_fee_krw ? (
                      <div className="mt-0.5 text-[9px] font-normal" style={{ color: 'var(--ink-3)' }}>
                        {Math.round(t.monthly_fee_krw / 1000)}천원
                      </div>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={tiers.length + 2} className="px-4 py-16 text-center" style={{ color: 'var(--ink-3)' }}>
                    데이터가 없습니다. 단가표를 업로드해 주세요.
                  </td>
                </tr>
              ) : null}
              {devices.map((d, idx) => {
                const isOdd = idx % 2 === 1;
                return (
                  <tr key={d.id} style={{ background: isOdd ? '#fafbff' : '#fff' }}>
                    <td
                      className="px-2 py-2 font-semibold"
                      style={{ borderBottom: '1px solid var(--line-2)' }}
                    >
                      <div>{d.name}</div>
                      <div className="mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
                        {d.code}
                      </div>
                    </td>
                    <td
                      className="mono px-2 py-2 text-right text-[11px]"
                      style={{ borderBottom: '1px solid var(--line-2)', color: 'var(--ink-3)' }}
                    >
                      {formatMan(d.retail)}
                    </td>
                    {tiers.map((t) => {
                      const cellMnp = d.byTierAct.get(`${t.code}|mnp`);
                      const cellChange = d.byTierAct.get(`${t.code}|change`);
                      const valMnp = cellMnp?.customer;
                      const valChange = cellChange?.customer;
                      return (
                        <td
                          key={t.id}
                          className="mono px-2 py-2 text-right"
                          style={{
                            borderBottom: '1px solid var(--line-2)',
                            borderLeft: '1px solid var(--line-2)',
                          }}
                        >
                          <div className="flex justify-end gap-1.5 text-[12px]">
                            <span style={{ color: (valMnp ?? 0) < 300000 ? 'var(--pink)' : 'var(--ink)', fontWeight: 700 }}>
                              {formatMan(valMnp ?? null)}
                            </span>
                            <span style={{ color: 'var(--line)' }}>/</span>
                            <span style={{ color: 'var(--ink-3)' }}>{formatMan(valChange ?? null)}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 안내 */}
        <div className="mt-5 grid gap-2.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="rounded-[10px] p-3 text-[12px]" style={{ background: 'var(--blue-soft)', color: 'var(--blue-2)' }}>
            <div className="mb-1 font-bold">📞 상담 문의</div>
            매장 방문 또는 카카오톡 문의
          </div>
          <div className="rounded-[10px] p-3 text-[12px]" style={{ background: 'var(--lime-soft)', color: '#4f5d07' }}>
            <div className="mb-1 font-bold">🎁 가입 혜택</div>
            유무선 결합 시 최대 100만원 지원
          </div>
          <div className="rounded-[10px] p-3 text-[12px]" style={{ background: 'var(--pink-soft)', color: '#b8246e' }}>
            <div className="mb-1 font-bold">🚚 당일 배송</div>
            오후 2시 이전 접수 시
          </div>
        </div>

        <div className="mt-4 text-[11px]" style={{ color: 'var(--ink-3)' }}>
          · 표기 가격은 만원 단위, <b style={{ color: 'var(--pink)' }}>이동(MNP)</b> / <span>기변</span> 순.
          · 공통지원금 기준, 선택약정 희망 시 별도 문의.
          · 요금제 사용 기간: 공통 6개월(185일) / 선택 4개월(130일)
        </div>
      </div>
    </div>
  );
}
