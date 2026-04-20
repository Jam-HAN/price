import { getSupabaseAdmin } from '@/lib/supabase';
import { createVendor, updateVendor, deleteVendor } from './actions';
import { CARRIERS } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const sb = getSupabaseAdmin();
  const { data: vendors } = await sb
    .from('price_vendors')
    .select('*')
    .order('display_order');

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">거래처</h1>
          <p className="mt-1 text-sm text-zinc-500">통신사별 거래처 관리 (총 {(vendors ?? []).length}곳)</p>
        </div>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">신규 추가</h2>
        <form action={createVendor} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-zinc-600">
            이름
            <input name="name" required className="mt-1 w-40 rounded border border-zinc-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            통신사
            <select name="carrier" required className="mt-1 w-28 rounded border border-zinc-300 px-2 py-1.5 text-sm">
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            순서
            <input
              name="display_order"
              type="number"
              defaultValue={0}
              className="mt-1 w-20 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700">추가</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left">이름</th>
              <th className="px-4 py-2 text-left">통신사</th>
              <th className="px-4 py-2 text-left">순서</th>
              <th className="px-4 py-2 text-left">활성</th>
              <th className="px-4 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {(vendors ?? []).map((v) => (
              <tr key={v.id} className="border-t border-zinc-100">
                <td colSpan={5} className="p-0">
                  <form
                    action={updateVendor}
                    className="grid grid-cols-[1fr_7rem_4rem_4rem_auto] items-center gap-2 px-4 py-2"
                  >
                    <input type="hidden" name="id" value={v.id} />
                    <input
                      name="name"
                      defaultValue={v.name}
                      className="rounded border border-transparent px-2 py-1 hover:border-zinc-200 focus:border-zinc-400"
                    />
                    <select
                      name="carrier"
                      defaultValue={v.carrier}
                      className="rounded border border-transparent px-2 py-1 hover:border-zinc-200 focus:border-zinc-400"
                    >
                      {CARRIERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      name="display_order"
                      type="number"
                      defaultValue={v.display_order}
                      className="rounded border border-transparent px-2 py-1 hover:border-zinc-200 focus:border-zinc-400"
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="active" defaultChecked={v.active} />
                      활성
                    </label>
                    <div className="flex justify-end gap-1">
                      <button className="rounded bg-zinc-100 px-2 py-1 text-xs hover:bg-zinc-200">저장</button>
                      <button
                        formAction={deleteVendor}
                        className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                      >
                        삭제
                      </button>
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
