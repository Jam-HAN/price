import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { UploadForm } from './UploadForm';

export const dynamic = 'force-dynamic';

export default async function UploadsPage() {
  const sb = getSupabaseAdmin();
  const [{ data: vendors }, { data: sheets }] = await Promise.all([
    sb.from('price_vendors').select('id, name, carrier, display_order').eq('active', true).order('display_order'),
    sb
      .from('price_vendor_quote_sheets')
      .select('id, effective_date, parse_status, uploaded_at, vendor:price_vendors(name, carrier)')
      .order('uploaded_at', { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">단가표 업로드</h1>
        <p className="mt-1 text-sm text-zinc-500">
          거래처 카톡 단가표 이미지 → Claude Vision으로 파싱 → 검수 후 저장
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold">신규 업로드</h2>
        <UploadForm vendors={vendors ?? []} />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm font-semibold">최근 업로드</div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left">일자</th>
              <th className="px-4 py-2 text-left">거래처</th>
              <th className="px-4 py-2 text-left">상태</th>
              <th className="px-4 py-2 text-left">업로드 시각</th>
              <th className="px-4 py-2 text-right">액션</th>
            </tr>
          </thead>
          <tbody>
            {(sheets ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                  업로드 이력이 없습니다.
                </td>
              </tr>
            ) : null}
            {(sheets ?? []).map((s) => {
              const vendor = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
              return (
                <tr key={s.id} className="border-t border-zinc-100">
                  <td className="px-4 py-2">{s.effective_date}</td>
                  <td className="px-4 py-2">
                    {vendor?.name} <span className="text-xs text-zinc-500">({vendor?.carrier})</span>
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={s.parse_status} />
                  </td>
                  <td className="px-4 py-2 text-xs text-zinc-500">
                    {new Date(s.uploaded_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/uploads/${s.id}`} className="text-xs font-semibold text-zinc-700 hover:text-zinc-900">
                      {s.parse_status === 'confirmed' ? '상세' : '검수 →'}
                    </Link>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: '대기', cls: 'bg-zinc-100 text-zinc-600' },
    parsing: { label: '파싱 중', cls: 'bg-blue-50 text-blue-600' },
    parsed: { label: '검수 대기', cls: 'bg-amber-50 text-amber-700' },
    confirmed: { label: '확정', cls: 'bg-emerald-50 text-emerald-700' },
    error: { label: '오류', cls: 'bg-red-50 text-red-600' },
  };
  const v = map[status] ?? { label: status, cls: 'bg-zinc-100 text-zinc-600' };
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}
