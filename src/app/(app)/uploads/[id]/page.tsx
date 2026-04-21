import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { signedUrl } from '@/lib/storage';
import type { SheetExtraction } from '@/lib/vision-schema';
import { formatKrw } from '@/lib/fmt';
import { confirmSheet, deleteSheet, updateParsed, autoRegisterMissingDevices } from './actions';
import { runAllChecks, dedupeFlagsByCell, flagKey } from '@/lib/consistency';
import { FullReparseButton } from './FullReparseButton';
import { EditableModelsTable } from './EditableModelsTable';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ confirmed?: string; auto_registered?: string }>;

export default async function SheetReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { confirmed, auto_registered } = await searchParams;
  const sb = getSupabaseAdmin();

  const { data: sheet } = await sb
    .from('price_vendor_quote_sheets')
    .select(
      'id, vendor_id, effective_date, policy_round, effective_time, image_url, parse_status, error_message, raw_ocr_json, uploaded_at, parsed_at, confirmed_at, notes, vendor:price_vendors(id,name,carrier)',
    )
    .eq('id', id)
    .single();
  if (!sheet) notFound();
  const vendor = Array.isArray(sheet.vendor) ? sheet.vendor[0] : sheet.vendor;

  const imageUrl = sheet.image_url ? await signedUrl(sheet.image_url).catch(() => null) : null;
  const raw = sheet.raw_ocr_json as SheetExtraction | null;

  // 확정 미리보기용: 매핑 가능 여부 검사
  const [{ data: aliases }, { data: devices }, { data: tiers }] = await Promise.all([
    sb.from('price_device_aliases').select('vendor_code, device_id').eq('vendor_id', sheet.vendor_id),
    sb.from('price_devices').select('id, model_code, nickname'),
    sb.from('price_plan_tiers').select('id, code').eq('carrier', vendor?.carrier ?? ''),
  ]);
  const aliasMap = new Map((aliases ?? []).map((a) => [a.vendor_code, a.device_id]));
  const deviceByCode = new Map((devices ?? []).map((d) => [d.model_code, d.id]));
  const deviceByNick = new Map((devices ?? []).map((d) => [d.nickname, d.id]));
  const tierCodes = new Set((tiers ?? []).map((t) => t.code));

  const unmappedModels: string[] = [];
  const unmappedTiers: string[] = [];
  for (const m of raw?.models ?? []) {
    const hit = aliasMap.get(m.model_code_raw) ?? deviceByCode.get(m.model_code_raw) ?? deviceByNick.get(m.nickname);
    if (!hit) unmappedModels.push(`${m.model_code_raw} · ${m.nickname}`);
    for (const t of m.tiers ?? []) {
      if (!tierCodes.has(t.plan_tier_code)) unmappedTiers.push(`${t.plan_tier_code} (${m.nickname})`);
    }
  }

  // Consistency check용 데이터 로드: 같은 통신사 짝거래처의 같은 일자 + 같은 거래처의 전일 시트
  const carrier = (vendor?.carrier ?? 'SKT') as 'SKT' | 'KT' | 'LGU+';
  const { data: pairVendors } = await sb
    .from('price_vendors')
    .select('id,name')
    .eq('carrier', carrier)
    .neq('id', sheet.vendor_id);
  const pairVendorIds = (pairVendors ?? []).map((v) => v.id);

  const [{ data: pairSheets }, { data: prevSheets }] = await Promise.all([
    pairVendorIds.length
      ? sb
          .from('price_vendor_quote_sheets')
          .select('id, vendor_id, effective_date, raw_ocr_json')
          .in('vendor_id', pairVendorIds)
          .eq('effective_date', sheet.effective_date)
          .order('uploaded_at', { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] as { raw_ocr_json: SheetExtraction | null }[] }),
    sb
      .from('price_vendor_quote_sheets')
      .select('raw_ocr_json, effective_date')
      .eq('vendor_id', sheet.vendor_id)
      .lt('effective_date', sheet.effective_date)
      .order('effective_date', { ascending: false })
      .limit(1),
  ]);

  const pairSheet = (pairSheets?.[0]?.raw_ocr_json as SheetExtraction | null) ?? null;
  const prevSheet = (prevSheets?.[0]?.raw_ocr_json as SheetExtraction | null) ?? null;

  const allFlags = raw
    ? runAllChecks({ sheet: raw, pair: pairSheet, previous: prevSheet, carrier })
    : [];
  const flagMap = dedupeFlagsByCell(allFlags);
  const redCount = Array.from(flagMap.values()).filter((f) => f.severity === 'red').length;
  const yellowCount = Array.from(flagMap.values()).filter((f) => f.severity === 'yellow').length;
  const flagMapObj: Record<string, (typeof allFlags)[number]> = {};
  for (const [k, v] of flagMap.entries()) flagMapObj[k] = v;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/uploads" className="hover:text-zinc-900">
              ← 단가표 업로드
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {vendor?.name} <span className="text-base font-normal text-zinc-500">({vendor?.carrier})</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {sheet.effective_date}
            {sheet.policy_round ? ` · ${sheet.policy_round}` : ''}
            {sheet.effective_time ? ` · ${sheet.effective_time}` : ''}
            {' · '}
            <span className="font-medium">{STATUS_LABEL[sheet.parse_status] ?? sheet.parse_status}</span>
          </p>
        </div>
        <form action={deleteSheet} className="inline">
          <input type="hidden" name="sheet_id" value={sheet.id} />
          <button className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">삭제</button>
        </form>
      </header>

      {confirmed ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ 확정 완료. Net가 매트릭스에 반영됩니다.
        </div>
      ) : null}
      {auto_registered ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          ✓ 자동 등록 완료: 신규 모델 {auto_registered.split('_')[0]}개, alias 연결 {auto_registered.split('_')[1] ?? 0}건
        </div>
      ) : null}
      {sheet.parse_status === 'error' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          파싱 오류: {sheet.error_message ?? '알 수 없음'}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">원본 이미지</h2>
            {sheet.image_url ? (
              <div className="flex items-center gap-2">
                <FullReparseButton sheetId={sheet.id} model="gemini" label="Gemini 3.1 Pro 전체 재파싱" color="emerald" />
                <FullReparseButton sheetId={sheet.id} model="claude" label="Claude Sonnet 전체 재파싱" color="sky" />
              </div>
            ) : null}
          </div>
          {imageUrl ? (
            <a href={imageUrl} target="_blank" rel="noopener">
              <img src={imageUrl} alt="단가표 원본" className="max-h-[700px] w-full rounded border border-zinc-200 object-contain" />
            </a>
          ) : (
            <p className="text-sm text-zinc-400">이미지 없음</p>
          )}
        </section>

        <section className="space-y-4">
          {raw ? (
            <>
              {(redCount > 0 || yellowCount > 0) && (
                <div className={`rounded-xl border p-4 ${redCount > 0 ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
                  <h2 className={`text-sm font-bold ${redCount > 0 ? 'text-red-900' : 'text-amber-900'}`}>
                    {redCount > 0 ? '⚠ 즉시 수정 필요' : '⚠ 검토 권장'}
                    <span className="ml-2 text-xs font-normal">
                      빨강 {redCount}개 · 노랑 {yellowCount}개
                    </span>
                  </h2>
                  <p className="mt-1 text-xs text-zinc-700">
                    페어 거래처·전일 데이터·범위·단조성으로 자동 비교. 빨간 셀은 확정 전 수정 필요.
                  </p>
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-zinc-700">플래그 상세 (최대 30개 표시)</summary>
                    <ul className="mt-1 space-y-0.5 text-zinc-800">
                      {Array.from(flagMap.values()).slice(0, 30).map((f) => (
                        <li key={flagKey(f)} className="font-mono text-[11px]">
                          <span className={`inline-block w-12 ${f.severity === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
                            [{f.severity}]
                          </span>
                          <span className="inline-block w-20">{f.reason}</span>{' '}
                          {f.model_code_raw}
                          {f.plan_tier_code ? ` · ${f.plan_tier_code}` : ''} · {f.field} — {f.detail}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              )}
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-semibold">파싱 요약</h2>
                <ul className="text-sm text-zinc-700">
                  <li>모델 수: <b>{raw.models?.length ?? 0}</b></li>
                  <li>정책: <b>{raw.policies?.length ?? 0}</b>건</li>
                  <li>매핑 누락 모델: <span className={unmappedModels.length ? 'font-bold text-amber-700' : ''}>{unmappedModels.length}</span></li>
                  <li>매핑 누락 구간: <span className={unmappedTiers.length ? 'font-bold text-amber-700' : ''}>{new Set(unmappedTiers).size}</span></li>
                </ul>
                {unmappedModels.length > 0 ? (
                  <>
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer text-amber-700">누락 모델 자세히 ({unmappedModels.length}개)</summary>
                      <ul className="mt-1 list-disc pl-5 text-zinc-600">
                        {unmappedModels.slice(0, 50).map((m) => <li key={m}>{m}</li>)}
                      </ul>
                    </details>
                    <form action={autoRegisterMissingDevices} className="mt-3">
                      <input type="hidden" name="sheet_id" value={sheet.id} />
                      <button className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                        누락 모델 자동 등록 + alias 연결 ({unmappedModels.length}개)
                      </button>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        파싱 결과에서 출고가·nickname·series를 추정해 모델 마스터에 추가하고 거래처 코드를 연결합니다.
                      </p>
                    </form>
                  </>
                ) : null}
              </div>

              <EditableModelsTable sheetId={sheet.id} raw={raw} flagMap={flagMapObj} />

              <PoliciesList policies={raw.policies ?? []} />

              <RawJsonEditor sheetId={sheet.id} raw={raw} />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
              {sheet.parse_status === 'parsing' ? '파싱 중… 잠시만요.' : '파싱 결과 없음'}
            </div>
          )}

          {raw && sheet.parse_status !== 'confirmed' ? (
            <form action={confirmSheet} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
              <input type="hidden" name="sheet_id" value={sheet.id} />
              <div className="text-sm text-zinc-600">
                {redCount > 0 ? (
                  <span className="font-semibold text-red-700">빨강 {redCount}개 수정 후 확정 가능</span>
                ) : (
                  <>검수 끝났으면 확정. 매핑 누락 행은 스킵됩니다.</>
                )}
              </div>
              <button
                disabled={redCount > 0}
                className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
              >
                확정
              </button>
            </form>
          ) : null}
        </section>
      </div>

      {sheet.notes ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <h3 className="mb-1 font-semibold text-amber-900">메모</h3>
          <pre className="whitespace-pre-wrap text-xs text-amber-800">{sheet.notes}</pre>
        </section>
      ) : null}
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  parsing: '파싱 중',
  parsed: '검수 대기',
  confirmed: '확정',
  error: '오류',
};

function PoliciesList({ policies }: { policies: SheetExtraction['policies'] }) {
  if (!policies?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold">파싱된 부가정책</h2>
      <ul className="space-y-1 text-sm">
        {policies.map((p, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">{p.category}</span>
            <div>
              <div>{p.name} {p.amount_krw != null ? <span className="text-zinc-500">· {formatKrw(p.amount_krw)}원</span> : null}</div>
              {p.conditions_text ? <div className="text-xs text-zinc-500">{p.conditions_text}</div> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RawJsonEditor({ sheetId, raw }: { sheetId: string; raw: SheetExtraction }) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold">raw JSON 편집 (고급)</summary>
      <form action={updateParsed} className="mt-2 space-y-2">
        <input type="hidden" name="sheet_id" value={sheetId} />
        <textarea
          name="raw_ocr_json"
          defaultValue={JSON.stringify(raw, null, 2)}
          rows={20}
          className="w-full rounded border border-zinc-300 p-2 font-mono text-xs"
        />
        <button className="rounded bg-zinc-100 px-3 py-1.5 text-xs hover:bg-zinc-200">JSON 저장</button>
      </form>
    </details>
  );
}
