import { getSupabaseAdmin } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sb = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: vendors }, { data: sheets }] = await Promise.all([
    sb.from('price_vendors').select('id, name, carrier, display_order').order('display_order'),
    sb
      .from('price_vendor_quote_sheets')
      .select('id, vendor_id, effective_date, parse_status, uploaded_at')
      .eq('effective_date', today),
  ]);

  const sheetByVendor = new Map((sheets ?? []).map((s) => [s.vendor_id, s]));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="mt-1 text-sm text-zinc-500">오늘({today}) 단가표 업로드 현황</p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">거래처 6곳</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(vendors ?? []).map((v) => {
            const sheet = sheetByVendor.get(v.id);
            const uploaded = !!sheet;
            return (
              <div
                key={v.id}
                className={`rounded-xl border p-4 ${
                  uploaded ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">{v.name}</span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{v.carrier}</span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  {uploaded
                    ? `업로드 완료 · ${sheet.parse_status}`
                    : '오늘 업로드 없음'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">빠른 링크</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/uploads" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
            단가표 업로드
          </Link>
          <Link href="/matrix" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
            Net가 매트릭스
          </Link>
          <Link href="/vendors" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
            거래처 관리
          </Link>
          <Link href="/devices" className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
            모델 관리
          </Link>
        </div>
      </section>
    </div>
  );
}
