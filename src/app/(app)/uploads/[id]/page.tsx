import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { signedUrl } from '@/lib/storage';
import type { SheetExtraction } from '@/lib/vision-schema';
import { formatKrw } from '@/lib/fmt';
import { confirmSheet, deleteSheet, updateParsed } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ confirmed?: string }>;

export default async function SheetReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { confirmed } = await searchParams;
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
      {sheet.parse_status === 'error' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          파싱 오류: {sheet.error_message ?? '알 수 없음'}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="rounded-xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold">원본 이미지</h2>
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
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-semibold">파싱 요약</h2>
                <ul className="text-sm text-zinc-700">
                  <li>모델 수: <b>{raw.models?.length ?? 0}</b></li>
                  <li>정책: <b>{raw.policies?.length ?? 0}</b>건</li>
                  <li>매핑 누락 모델: <span className={unmappedModels.length ? 'font-bold text-amber-700' : ''}>{unmappedModels.length}</span></li>
                  <li>매핑 누락 구간: <span className={unmappedTiers.length ? 'font-bold text-amber-700' : ''}>{new Set(unmappedTiers).size}</span></li>
                </ul>
                {unmappedModels.length > 0 ? (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer text-amber-700">누락 모델 자세히</summary>
                    <ul className="mt-1 list-disc pl-5 text-zinc-600">
                      {unmappedModels.slice(0, 20).map((m) => <li key={m}>{m}</li>)}
                    </ul>
                    <p className="mt-2 text-zinc-500">
                      <Link href="/aliases" className="underline">거래처 코드 매핑</Link>이나 <Link href="/devices" className="underline">모델 마스터</Link>에 등록하면 확정 시 자동 반영됩니다.
                    </p>
                  </details>
                ) : null}
              </div>

              <ModelsTable raw={raw} />

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
                검수 끝났으면 확정. 매핑 누락 행은 스킵됩니다.
              </div>
              <button className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
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

function ModelsTable({ raw }: { raw: SheetExtraction }) {
  const tierCodes = Array.from(
    new Set((raw.models ?? []).flatMap((m) => (m.tiers ?? []).map((t) => t.plan_tier_code))),
  );
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2">
        <h2 className="text-sm font-semibold">파싱된 모델 × 구간</h2>
        <span className="text-xs text-zinc-500">단가(공통/선약 × 010/MNP/기변)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th className="sticky left-0 bg-zinc-50 px-2 py-2 text-left">모델</th>
              <th className="px-2 py-2 text-right">출고가</th>
              {tierCodes.map((code) => (
                <th key={code} colSpan={6} className="border-l border-zinc-200 px-2 py-2 text-center">
                  {code}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 bg-zinc-50 px-2 py-1" />
              <th className="px-2 py-1" />
              {tierCodes.map((code) => (
                <ThTypeHeader key={code} />
              ))}
            </tr>
          </thead>
          <tbody>
            {(raw.models ?? []).map((m, i) => (
              <tr key={i} className="border-t border-zinc-100">
                <td className="sticky left-0 bg-white px-2 py-1.5 font-medium">
                  <div>{m.nickname}</div>
                  <div className="font-mono text-[10px] text-zinc-400">{m.model_code_raw}</div>
                </td>
                <td className="px-2 py-1.5 text-right font-mono">{formatKrw(m.retail_price_krw)}</td>
                {tierCodes.map((code) => {
                  const tier = m.tiers?.find((t) => t.plan_tier_code === code);
                  if (!tier) return <td key={code} colSpan={6} className="border-l border-zinc-100 px-2 py-1 text-center text-zinc-300">—</td>;
                  return (
                    <>
                      <PriceCell key={`${code}-c-new`} v={tier.common?.new010} />
                      <PriceCell key={`${code}-c-mnp`} v={tier.common?.mnp} />
                      <PriceCell key={`${code}-c-ch`} v={tier.common?.change} />
                      <PriceCell key={`${code}-s-new`} v={tier.select?.new010} dim />
                      <PriceCell key={`${code}-s-mnp`} v={tier.select?.mnp} dim />
                      <PriceCell key={`${code}-s-ch`} v={tier.select?.change} dim />
                    </>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThTypeHeader() {
  return (
    <>
      <th className="border-l border-zinc-200 px-1 py-1 text-[10px] font-normal">공·010</th>
      <th className="px-1 py-1 text-[10px] font-normal">공·MNP</th>
      <th className="px-1 py-1 text-[10px] font-normal">공·기변</th>
      <th className="px-1 py-1 text-[10px] font-normal text-zinc-400">선·010</th>
      <th className="px-1 py-1 text-[10px] font-normal text-zinc-400">선·MNP</th>
      <th className="px-1 py-1 text-[10px] font-normal text-zinc-400">선·기변</th>
    </>
  );
}

function PriceCell({ v, dim }: { v?: number | null; dim?: boolean }) {
  if (v == null) return <td className={`px-1 py-1 text-center text-zinc-300 ${dim ? '' : ''}`}>—</td>;
  const neg = v < 0;
  return (
    <td className={`px-1 py-1 text-right font-mono ${neg ? 'text-red-600' : ''} ${dim ? 'text-zinc-500' : ''}`}>
      {(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}
    </td>
  );
}

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
