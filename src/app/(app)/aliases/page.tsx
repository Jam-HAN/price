import { getSupabaseAdmin } from '@/lib/supabase';
import { createAlias, deleteAlias } from './actions';

export const dynamic = 'force-dynamic';

export default async function AliasesPage() {
  const sb = getSupabaseAdmin();
  const [{ data: aliases }, { data: vendors }, { data: devices }] = await Promise.all([
    sb
      .from('price_device_aliases')
      .select('id, vendor_code, vendor:price_vendors(id,name,carrier), device:price_devices(id,model_code,nickname)')
      .order('vendor_code'),
    sb.from('price_vendors').select('id, name, carrier').order('display_order'),
    sb.from('price_devices').select('id, model_code, nickname').eq('active', true).order('nickname'),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">거래처 코드 매핑</h1>
        <p className="mt-1 text-sm text-zinc-500">
          거래처마다 쓰는 모델 코드(예: SM-S942N_512G / UIP17-256)를 내부 모델에 매핑. 단가표 파싱 시 자동 활용.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">매핑 추가</h2>
        <form action={createAlias} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs text-zinc-600">
            거래처
            <select name="vendor_id" required className="mt-1 w-40 rounded border border-zinc-300 px-2 py-1.5 text-sm">
              {(vendors ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.name} ({v.carrier})</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            내부 모델
            <select name="device_id" required className="mt-1 w-60 rounded border border-zinc-300 px-2 py-1.5 text-sm">
              {(devices ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.nickname} ({d.model_code})</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col text-xs text-zinc-600">
            거래처 코드
            <input name="vendor_code" required placeholder="SM-S942N_512G" className="mt-1 w-52 rounded border border-zinc-300 px-2 py-1.5 text-sm font-mono" />
          </label>
          <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700">추가</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left">거래처</th>
              <th className="px-4 py-2 text-left">거래처 코드</th>
              <th className="px-4 py-2 text-left">내부 모델</th>
              <th className="px-4 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {(aliases ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
                  등록된 매핑이 없습니다.
                </td>
              </tr>
            ) : null}
            {(aliases ?? []).map((a) => {
              const vendor = Array.isArray(a.vendor) ? a.vendor[0] : a.vendor;
              const device = Array.isArray(a.device) ? a.device[0] : a.device;
              return (
                <tr key={a.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2">
                    {vendor?.name} <span className="ml-1 text-xs text-zinc-500">({vendor?.carrier})</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{a.vendor_code}</td>
                  <td className="px-4 py-2">
                    {device?.nickname} <span className="ml-1 text-xs text-zinc-400">({device?.model_code})</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={deleteAlias} className="inline">
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">삭제</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
