import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { createDevice, updateDevice, deleteDevice } from './actions';
import { DeviceCurator } from './DeviceCurator';

export const dynamic = 'force-dynamic';

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
      {/* 한 줄짜리 신규 추가 — 필수 필드만 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-3">
        <form action={createDevice} className="grid grid-cols-[11rem_minmax(0,1fr)_5rem_8rem_auto] items-end gap-2">
          <label className="flex flex-col text-[11px] text-zinc-500">
            model_code
            <input name="model_code" required placeholder="SM-S942N_256G" className="mt-0.5 rounded border border-zinc-300 px-2 py-1.5 text-sm font-mono" />
          </label>
          <label className="flex flex-col text-[11px] text-zinc-500">
            nickname
            <input name="nickname" required placeholder="갤럭시 S26 256G" className="mt-0.5 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-[11px] text-zinc-500">
            용량
            <input name="storage" placeholder="256G" className="mt-0.5 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-[11px] text-zinc-500">
            출고가(원)
            <input name="retail_price_krw" type="number" required className="mt-0.5 rounded border border-zinc-300 px-2 py-1.5 text-right text-sm" />
          </label>
          <input type="hidden" name="active" value="on" />
          <button className="h-9 rounded-lg bg-zinc-900 px-5 text-sm text-white hover:bg-zinc-700">추가</button>
        </form>
      </section>

      {/* 리스트 — code / nickname / 용량 / 출고가 / 활성 / 삭제 */}
      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[11rem_minmax(0,1fr)_5rem_8rem_4rem_5rem] items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          <div>code</div>
          <div>nickname</div>
          <div>용량</div>
          <div className="text-right">출고가</div>
          <div className="text-center">활성</div>
          <div className="text-right">삭제</div>
        </div>
        {(devices ?? []).length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">등록된 모델이 없습니다.</div>
        ) : null}
        {(devices ?? []).map((d) => (
          <form key={d.id} action={updateDevice} className="grid grid-cols-[11rem_minmax(0,1fr)_5rem_8rem_4rem_5rem] items-center gap-3 border-t border-zinc-100 px-4 py-1.5 hover:bg-zinc-50">
            <input type="hidden" name="id" value={d.id} />
            <input type="hidden" name="manufacturer" defaultValue={d.manufacturer ?? ''} />
            <input type="hidden" name="series" defaultValue={d.series ?? ''} />
            <input type="hidden" name="category" defaultValue={d.category ?? '5G'} />
            <input type="hidden" name="display_order" defaultValue={d.display_order ?? 0} />
            <input type="hidden" name="is_new" defaultValue={d.is_new ? 'on' : ''} />
            <input name="model_code" defaultValue={d.model_code} className="rounded border border-transparent px-1.5 py-1 font-mono text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
            <input name="nickname" defaultValue={d.nickname} className="rounded border border-transparent px-1.5 py-1 text-sm hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
            <input name="storage" defaultValue={d.storage ?? ''} className="rounded border border-transparent px-1.5 py-1 text-xs hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
            <input name="retail_price_krw" type="number" defaultValue={d.retail_price_krw} className="rounded border border-transparent px-1.5 py-1 text-right text-sm font-mono hover:border-zinc-200 focus:border-zinc-400 focus:bg-white" />
            <div className="flex justify-center">
              <input type="checkbox" name="active" defaultChecked={d.active} className="h-4 w-4" />
            </div>
            <div className="flex justify-end gap-1">
              <button className="rounded bg-zinc-100 px-2.5 py-1 text-xs hover:bg-zinc-200">저장</button>
              <button formAction={deleteDevice} className="rounded bg-red-50 px-2.5 py-1 text-xs text-red-600 hover:bg-red-100">삭제</button>
            </div>
          </form>
        ))}
      </section>
      </>
      )}
    </div>
  );
}
