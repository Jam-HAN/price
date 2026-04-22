import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { PageHeader, StatCard, Chip, CarrierPill, type CarrierKey } from '@/components/ui';

export const dynamic = 'force-dynamic';

function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default async function DashboardPage() {
  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [
    { data: vendors },
    { data: todaySheets },
    { data: weekSheets },
    { count: activeDeviceCount },
    { data: recentSheets },
    { data: corrections },
  ] = await Promise.all([
    sb.from('price_vendors').select('id, name, carrier').eq('active', true).order('display_order'),
    sb.from('price_vendor_quote_sheets').select('id, vendor_id').eq('effective_date', today),
    sb.from('price_vendor_quote_sheets').select('id, vendor_id, effective_date').gte('effective_date', weekAgo),
    sb.from('price_devices').select('id', { count: 'exact', head: true }).eq('active', true),
    sb
      .from('price_vendor_quote_sheets')
      .select('id, effective_date, parse_status, uploaded_at, vendor:price_vendors(name, carrier)')
      .order('uploaded_at', { ascending: false })
      .limit(6),
    sb
      .from('price_cell_corrections')
      .select('id, corrected_at, model_code_raw, field, flag_reason')
      .order('corrected_at', { ascending: false })
      .limit(8),
  ]);

  const vendorById = new Map((vendors ?? []).map((v) => [v.id, v]));

  // 이번주 업로드 일별 집계 (일자별 건수)
  const dayBuckets = new Array(7).fill(0);
  for (const s of weekSheets ?? []) {
    const d = new Date(s.effective_date);
    const idx = 6 - Math.floor((Date.now() - d.getTime()) / 86400000);
    if (idx >= 0 && idx < 7) dayBuckets[idx]++;
  }
  const maxBar = Math.max(...dayBuckets, 1);
  const weekTotal = dayBuckets.reduce((a, b) => a + b, 0);

  // 통신사별 이번주 업로드 비율
  const carrierCounts: Record<CarrierKey, number> = { SKT: 0, KT: 0, 'LGU+': 0 };
  for (const s of weekSheets ?? []) {
    const v = vendorById.get(s.vendor_id);
    if (v) carrierCounts[v.carrier as CarrierKey]++;
  }
  const carrierTotal = (weekSheets ?? []).length || 1;

  // 오늘 업로드 건수
  const todayVendorIds = new Set((todaySheets ?? []).map((s) => s.vendor_id));
  const todayCount = todayVendorIds.size;

  return (
    <>
      <PageHeader
        crumbs={['대박통신', '대시보드']}
        title="오늘의 한눈에 보기"
        actions={
          <>
            <Link href="/uploads" className="btn btn-ghost">
              {today}
            </Link>
            <Link href="/uploads" className="btn btn-primary">
              + 단가표 업로드
            </Link>
          </>
        }
      />

      {/* Stats */}
      <div className="mb-4 grid grid-cols-4 gap-3.5">
        <StatCard
          pill="TODAY"
          pillTone="blue"
          label="오늘 업로드한 거래처"
          value={`${todayCount}/${vendors?.length ?? 0}`}
          delta={todayCount === vendors?.length ? '전부 업로드 완료' : `${(vendors?.length ?? 0) - todayCount}곳 대기`}
          deltaDown={todayCount !== vendors?.length}
        />
        <StatCard
          pill="WEEKLY"
          pillTone="lime"
          label="이번 주 업로드"
          value={weekTotal}
          delta={`${Math.round((weekTotal / 42) * 100)}% 커버리지`}
        />
        <StatCard
          pill="MODELS"
          pillTone="pink"
          label="활성 모델"
          value={activeDeviceCount ?? 0}
          delta="마스터 등록"
        />
        <StatCard
          pill="FIXES"
          pillTone="yellow"
          label="누적 정답 쌍"
          value={(corrections ?? []).length >= 8 ? '+' + 8 : (corrections ?? []).length}
          delta="파인튜닝 데이터"
        />
      </div>

      {/* Charts row */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        {/* 주간 추이 */}
        <div className="card">
          <div className="card-h">
            <h3>주간 업로드 추이</h3>
            <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              최근 7일
            </span>
          </div>
          <div className="card-b">
            <div className="flex items-end gap-1.5" style={{ height: 160, borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
              {dayBuckets.map((v, i) => {
                const isToday = i === 6;
                return (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="text-[10px] font-semibold" style={{ color: 'var(--ink-3)' }}>
                      {v}
                    </div>
                    <div
                      className="w-full"
                      style={{
                        height: `${(v / maxBar) * 120}px`,
                        minHeight: 2,
                        borderRadius: '6px 6px 0 0',
                        background: isToday ? 'var(--blue)' : 'linear-gradient(180deg, #b9c9ff, #eaf0ff)',
                        border: isToday ? 'none' : '1px solid #d7e1ff',
                      }}
                    />
                    <div className="text-[10px]" style={{ color: 'var(--ink-3)' }}>
                      {['월', '화', '수', '목', '금', '토', '일'][(new Date(Date.now() - (6 - i) * 86400000).getDay() + 6) % 7]}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 pt-3 text-[12px]" style={{ color: 'var(--ink-3)' }}>
              <span>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--blue)' }} />
                오늘
              </span>
              <span>
                <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: '#b9c9ff' }} />
                지난 주
              </span>
              <span className="ml-auto">
                총 업로드 <b className="mono" style={{ color: 'var(--ink)' }}>{weekTotal}건</b>
              </span>
            </div>
          </div>
        </div>

        {/* 통신사별 비중 */}
        <div className="card">
          <div className="card-h">
            <h3>통신사별 업로드</h3>
          </div>
          <div className="card-b">
            {(['SKT', 'KT', 'LGU+'] as CarrierKey[]).map((c) => {
              const pct = Math.round((carrierCounts[c] / carrierTotal) * 100);
              const barColor = c === 'SKT' ? 'var(--skt-fg)' : c === 'KT' ? 'var(--kt-fg)' : 'var(--lgu-fg)';
              return (
                <div key={c} className="mb-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <CarrierPill id={c} />
                    <span className="mono text-[13px] font-bold">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--line-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
            <div className="my-4 border-t" style={{ borderColor: 'var(--line)' }} />
            <div className="mb-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
              거래처 업로드 현황
            </div>
            {(vendors ?? []).slice(0, 3).map((v) => {
              const uploaded = todayVendorIds.has(v.id);
              return (
                <div key={v.id} className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span>
                    {v.name} <span style={{ color: 'var(--ink-3)' }}>({v.carrier})</span>
                  </span>
                  {uploaded ? <Chip tone="mint">완료</Chip> : <Chip tone="yellow">대기</Chip>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="card">
          <div className="card-h">
            <h3>최근 업로드</h3>
            <Link href="/uploads" className="btn btn-sm btn-ghost">
              전체보기 ›
            </Link>
          </div>
          <table className="t">
            <thead>
              <tr>
                <th>거래처</th>
                <th>통신사</th>
                <th>일자</th>
                <th className="right">상태</th>
              </tr>
            </thead>
            <tbody>
              {(recentSheets ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center" style={{ color: 'var(--ink-3)' }}>
                    아직 업로드가 없습니다.
                  </td>
                </tr>
              ) : null}
              {(recentSheets ?? []).map((s) => {
                const vendor = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/uploads/${s.id}`} className="font-semibold hover:underline">
                        {vendor?.name}
                      </Link>
                      <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                        {relativeTime(s.uploaded_at)}
                      </div>
                    </td>
                    <td>
                      <CarrierPill id={vendor?.carrier as CarrierKey} />
                    </td>
                    <td className="mono text-[12px]" style={{ color: 'var(--ink-2)' }}>
                      {s.effective_date}
                    </td>
                    <td className="right">
                      {s.parse_status === 'confirmed' ? <Chip tone="mint">확정</Chip> : null}
                      {s.parse_status === 'parsed' ? <Chip tone="yellow">검토</Chip> : null}
                      {s.parse_status === 'parsing' ? <Chip tone="blue">파싱중</Chip> : null}
                      {s.parse_status === 'error' ? <Chip tone="pink">오류</Chip> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>최근 수정</h3>
          </div>
          <div style={{ padding: 0 }}>
            {(corrections ?? []).length === 0 ? (
              <div className="py-10 text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
                아직 수정 내역이 없습니다.
              </div>
            ) : null}
            {(corrections ?? []).map((c, i) => (
              <div
                key={c.id}
                className="flex gap-3 px-5 py-3"
                style={{ borderBottom: i < (corrections ?? []).length - 1 ? '1px solid var(--line-2)' : 'none' }}
              >
                <div
                  className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] text-[13px]"
                  style={{ background: 'var(--line-2)', color: 'var(--blue)' }}
                >
                  ✎
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px]">
                    <b>{c.model_code_raw}</b>
                    <span style={{ color: 'var(--ink-3)' }}> · {c.field}</span>
                  </div>
                  <div className="mt-1 text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {relativeTime(c.corrected_at)}
                    {c.flag_reason ? ` · ${c.flag_reason}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
