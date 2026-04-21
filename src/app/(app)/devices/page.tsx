import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createDevice, updateDevice, deleteDevice } from './actions';
import { DeviceCurator } from './DeviceCurator';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['5G', 'LTE', 'S-D', '기타'] as const;

type SearchParams = Promise<{ mode?: 'curate' | 'edit' }>;

export default async function DevicesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const mode = sp.mode ?? 'curate';
  const sb = getSupabaseAdmin();
  const { data: devices } = await sb
    .from('price_devices')
    .select('*')
    .order('display_order')
    .order('nickname');

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between">
        <h1 className="text-2xl font-bold tracking-tight">모델</h1>
        <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 text-xs">
          <Link
            href="/devices?mode=curate"
            className={`rounded-full px-3 py-1 ${mode === 'curate' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
          >
            판매 설정
          </Link>
          <Link
            href="/devices?mode=edit"
            className={`rounded-full px-3 py-1 ${mode === 'edit' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}
          >
            편집
          </Link>
        </div>
      </header>

      {mode === 'curate' ? (
        <DeviceCurator devices={devices ?? []} />
      ) : null}

      {mode !== 'edit' ? null : (
      <>
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">신규 추가</h2>
        <form action={createDevice} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="flex flex-col text-xs text-zinc-500">
            model_code*
            <input name="model_code" required className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm font-mono" />
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            nickname*
            <input name="nickname" required className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            제조사
            <input name="manufacturer" placeholder="Samsung / Apple" className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            시리즈
            <input name="series" placeholder="galaxyS26 / iphone17" className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            용량
            <input name="storage" placeholder="256G / 512G / 1TB" className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            출고가 (원)*
            <input name="retail_price_krw" type="number" required className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm text-right" />
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            카테고리
            <select name="category" defaultValue="5G" className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-500">
            순서
            <input name="display_order" type="number" defaultValue={0} className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <div className="col-span-2 flex items-center gap-4 md:col-span-4">
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="is_new" /> NEW</label>
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked /> 활성</label>
            <button className="ml-auto rounded-lg bg-zinc-900 px-4 py-1.5 text-sm text-white hover:bg-zinc-700">추가</button>
          </div>
        </form>
      </section>

      <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        {/* 헤더와 바디 모두 같은 grid-template-columns 사용 → 컬럼 정확히 정렬 */}
        <div className="min-w-[1200px]">
          <div className="grid grid-cols-[9rem_minmax(0,1fr)_6rem_7rem_4rem_6rem_5rem_3rem_3rem_3rem_7rem] items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <div>code</div>
            <div>nickname</div>
            <div>제조사</div>
            <div>시리즈</div>
            <div>용량</div>
            <div className="text-right">출고가</div>
            <div>카테고리</div>
            <div className="text-center">NEW</div>
            <div className="text-right">순서</div>
            <div className="text-center">활성</div>
            <div className="text-right">액션</div>
          </div>
          {(devices ?? []).length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">등록된 모델이 없습니다.</div>
          ) : null}
          {(devices ?? []).map((d) => (
            <form key={d.id} action={updateDevice} className="grid grid-cols-[9rem_minmax(0,1fr)_6rem_7rem_4rem_6rem_5rem_3rem_3rem_3rem_7rem] items-center gap-2 border-t border-zinc-100 px-3 py-1.5 hover:bg-zinc-50">
              <input type="hidden" name="id" value={d.id} />
              <input name="model_code" defaultValue={d.model_code} className="rounded border border-transparent px-1.5 py-1 font-mono text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
              <input name="nickname" defaultValue={d.nickname} className="rounded border border-transparent px-1.5 py-1 text-sm hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
              <input name="manufacturer" defaultValue={d.manufacturer ?? ''} className="rounded border border-transparent px-1.5 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
              <input name="series" defaultValue={d.series ?? ''} className="rounded border border-transparent px-1.5 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
              <input name="storage" defaultValue={d.storage ?? ''} className="rounded border border-transparent px-1.5 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
              <input name="retail_price_krw" type="number" defaultValue={d.retail_price_krw} className="rounded border border-transparent px-1.5 py-1 text-right text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
              <select name="category" defaultValue={d.category} className="rounded border border-transparent px-1.5 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white">
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <div className="flex justify-center">
                <input type="checkbox" name="is_new" defaultChecked={d.is_new} className="h-4 w-4" />
              </div>
              <input name="display_order" type="number" defaultValue={d.display_order} className="rounded border border-transparent px-1.5 py-1 text-right text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
              <div className="flex justify-center">
                <input type="checkbox" name="active" defaultChecked={d.active} className="h-4 w-4" />
              </div>
              <div className="flex justify-end gap-1">
                <button className="rounded bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">저장</button>
                <button formAction={deleteDevice} className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">삭제</button>
              </div>
            </form>
          ))}
        </div>
      </section>
      </>
      )}
    </div>
  );
}
