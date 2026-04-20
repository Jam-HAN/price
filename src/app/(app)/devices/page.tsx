import { getSupabaseAdmin } from '@/lib/supabase';
import { formatKrw } from '@/lib/fmt';
import { createDevice, updateDevice, deleteDevice } from './actions';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['5G', 'LTE', 'S-D', '기타'] as const;

export default async function DevicesPage() {
  const sb = getSupabaseAdmin();
  const { data: devices } = await sb
    .from('price_devices')
    .select('*')
    .order('display_order')
    .order('nickname');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">모델</h1>
        <p className="mt-1 text-sm text-zinc-500">단말기 마스터 — 출고가 기준 (총 {(devices ?? []).length}개)</p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">신규 추가</h2>
        <form action={createDevice} className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <label className="flex flex-col text-xs text-zinc-600">
            model_code*
            <input name="model_code" required className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm font-mono" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            nickname*
            <input name="nickname" required className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            제조사
            <input name="manufacturer" placeholder="Samsung / Apple" className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            시리즈
            <input name="series" placeholder="galaxyS26 / iphone17 / fold7" className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            저장용량
            <input name="storage" placeholder="256G / 512G / 1TB" className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            출고가(원)*
            <input name="retail_price_krw" type="number" required className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm text-right" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            카테고리
            <select name="category" defaultValue="5G" className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            순서
            <input name="display_order" type="number" defaultValue={0} className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <div className="col-span-2 flex items-center gap-4 md:col-span-4">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="is_new" /> NEW
            </label>
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" name="active" defaultChecked /> 활성
            </label>
            <button className="ml-auto rounded-lg bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700">
              추가
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2 py-2 text-left">model_code</th>
              <th className="px-2 py-2 text-left">nickname</th>
              <th className="px-2 py-2 text-left">제조사</th>
              <th className="px-2 py-2 text-left">시리즈</th>
              <th className="px-2 py-2 text-left">용량</th>
              <th className="px-2 py-2 text-right">출고가</th>
              <th className="px-2 py-2 text-left">카테고리</th>
              <th className="px-2 py-2 text-left">NEW</th>
              <th className="px-2 py-2 text-left">순서</th>
              <th className="px-2 py-2 text-left">활성</th>
              <th className="px-2 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {(devices ?? []).length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-sm text-zinc-400">
                  등록된 모델이 없습니다. 위에서 추가하거나, 단가표 업로드 시 자동 제안됩니다.
                </td>
              </tr>
            ) : null}
            {(devices ?? []).map((d) => (
              <tr key={d.id} className="border-t border-zinc-100">
                <td colSpan={11} className="p-0">
                  <form action={updateDevice} className="grid grid-cols-[8rem_10rem_6rem_7rem_4rem_6rem_4rem_3rem_3rem_3rem_auto] items-center gap-1 px-2 py-1">
                    <input type="hidden" name="id" value={d.id} />
                    <input name="model_code" defaultValue={d.model_code} className="rounded border border-transparent px-1 py-1 font-mono text-xs hover:border-zinc-200 focus:border-zinc-400" />
                    <input name="nickname" defaultValue={d.nickname} className="rounded border border-transparent px-1 py-1 hover:border-zinc-200 focus:border-zinc-400" />
                    <input name="manufacturer" defaultValue={d.manufacturer ?? ''} className="rounded border border-transparent px-1 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400" />
                    <input name="series" defaultValue={d.series ?? ''} className="rounded border border-transparent px-1 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400" />
                    <input name="storage" defaultValue={d.storage ?? ''} className="rounded border border-transparent px-1 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400" />
                    <input name="retail_price_krw" type="number" defaultValue={d.retail_price_krw} className="rounded border border-transparent px-1 py-1 text-right text-xs hover:border-zinc-200 focus:border-zinc-400" />
                    <select name="category" defaultValue={d.category} className="rounded border border-transparent px-1 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400">
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <label className="flex items-center justify-center"><input type="checkbox" name="is_new" defaultChecked={d.is_new} /></label>
                    <input name="display_order" type="number" defaultValue={d.display_order} className="rounded border border-transparent px-1 py-1 text-right text-xs hover:border-zinc-200 focus:border-zinc-400" />
                    <label className="flex items-center justify-center"><input type="checkbox" name="active" defaultChecked={d.active} /></label>
                    <div className="flex justify-end gap-1">
                      <button className="rounded bg-zinc-100 px-2 py-0.5 text-xs hover:bg-zinc-200">저장</button>
                      <button formAction={deleteDevice} className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100">삭제</button>
                    </div>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
