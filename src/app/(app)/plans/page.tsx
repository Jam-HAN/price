import { getSupabaseAdmin } from '@/lib/supabase';
import { CARRIERS, formatKrw } from '@/lib/fmt';
import { createTier, updateTier, deleteTier } from './actions';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  const sb = getSupabaseAdmin();
  const { data: tiers } = await sb
    .from('price_plan_tiers')
    .select('*')
    .order('carrier')
    .order('display_order');

  const byCarrier = new Map<string, typeof tiers>();
  for (const c of CARRIERS) byCarrier.set(c, []);
  for (const t of tiers ?? []) byCarrier.get(t.carrier)?.push(t as never);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">요금제 구간</h1>
        <p className="mt-1 text-sm text-zinc-500">
          통신사별 단가표 컬럼 구간 마스터. 거래처 표기가 달라도 여기에 통일 저장.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">신규 추가</h2>
        <form action={createTier} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-zinc-600">
            통신사
            <select name="carrier" required className="mt-1 w-24 rounded border border-zinc-300 px-2 py-1.5 text-sm">
              {CARRIERS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            코드
            <input name="code" required placeholder="예: I_100" className="mt-1 w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            라벨
            <input name="label" required className="mt-1 w-80 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            월 요금(원)
            <input name="monthly_fee_krw" type="number" className="mt-1 w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            순서
            <input name="display_order" type="number" defaultValue={0} className="mt-1 w-20 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700">추가</button>
        </form>
      </section>

      {CARRIERS.map((carrier) => {
        const rows = byCarrier.get(carrier) ?? [];
        return (
          <section key={carrier} className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm font-semibold">
              {carrier} <span className="ml-2 text-xs font-normal text-zinc-500">{rows.length}개 구간</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">코드</th>
                  <th className="px-3 py-2 text-left">라벨</th>
                  <th className="px-3 py-2 text-left">월 요금</th>
                  <th className="px-3 py-2 text-left">순서</th>
                  <th className="px-3 py-2 text-left">활성</th>
                  <th className="px-3 py-2 text-right">액션</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-100">
                    <td colSpan={6} className="p-0">
                      <form action={updateTier} className="grid grid-cols-[6rem_1fr_6rem_4rem_4rem_auto] items-center gap-2 px-3 py-1.5">
                        <input type="hidden" name="id" value={t.id} />
                        <input name="code" defaultValue={t.code} className="rounded border border-transparent px-2 py-1 font-mono text-xs hover:border-zinc-200 focus:border-zinc-400" />
                        <input name="label" defaultValue={t.label} className="rounded border border-transparent px-2 py-1 hover:border-zinc-200 focus:border-zinc-400" />
                        <input name="monthly_fee_krw" type="number" defaultValue={t.monthly_fee_krw ?? ''} className="rounded border border-transparent px-2 py-1 text-right hover:border-zinc-200 focus:border-zinc-400" />
                        <input name="display_order" type="number" defaultValue={t.display_order} className="rounded border border-transparent px-2 py-1 hover:border-zinc-200 focus:border-zinc-400" />
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" name="active" defaultChecked={t.active} />
                          활성
                        </label>
                        <div className="flex justify-end gap-1">
                          <button className="rounded bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">저장</button>
                          <button formAction={deleteTier} className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">
                            삭제
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-xs text-zinc-400">
                      구간 없음
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
