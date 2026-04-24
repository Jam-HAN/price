import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase';
import { formatKstDateTime } from '@/lib/fmt';
import { UploadForm } from './UploadForm';
import { PageHeader, Chip, CarrierPill, type CarrierKey } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function UploadsPage() {
  const sb = getSupabaseAdmin();
  const [{ data: vendors }, { data: sheets }] = await Promise.all([
    sb.from('price_vendors').select('id, name, carrier, display_order, crop_spec').eq('active', true).order('display_order'),
    sb
      .from('price_vendor_quote_sheets')
      .select('id, effective_date, parse_status, uploaded_at, vendor:price_vendors(name, carrier)')
      .order('uploaded_at', { ascending: false })
      .limit(30),
  ]);

  return (
    <>
      <PageHeader crumbs={['대박통신', '업로드']} title="단가표 업로드" />

      <div className="card mb-4">
        <div className="card-h">
          <h3>신규 업로드</h3>
        </div>
        <div className="card-b">
          <UploadForm vendors={vendors ?? []} />
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>최근 업로드</h3>
          <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            최근 30건
          </span>
        </div>
        <table className="t">
          <thead>
            <tr>
              <th>일자</th>
              <th>거래처</th>
              <th>통신사</th>
              <th>상태</th>
              <th>업로드</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {(sheets ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center" style={{ color: 'var(--ink-3)' }}>
                  업로드 이력이 없습니다.
                </td>
              </tr>
            ) : null}
            {(sheets ?? []).map((s) => {
              const vendor = Array.isArray(s.vendor) ? s.vendor[0] : s.vendor;
              return (
                <tr key={s.id}>
                  <td className="mono text-center">{s.effective_date}</td>
                  <td className="text-center">
                    <b>{vendor?.name}</b>
                  </td>
                  <td className="text-center">{vendor ? <CarrierPill id={vendor.carrier as CarrierKey} /> : null}</td>
                  <td className="text-center">
                    <StatusChip status={s.parse_status} />
                  </td>
                  <td className="text-center text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {formatKstDateTime(s.uploaded_at)}
                  </td>
                  <td className="text-center">
                    <Link href={`/uploads/${s.id}`} className="btn btn-sm btn-ghost">
                      {s.parse_status === 'confirmed' ? '상세' : '검수 →'}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusChip({ status }: { status: string }) {
  if (status === 'confirmed') return <Chip tone="mint">확정</Chip>;
  if (status === 'parsed') return <Chip tone="yellow">검수 대기</Chip>;
  if (status === 'parsing') return <Chip tone="blue">파싱 중</Chip>;
  if (status === 'error') return <Chip tone="pink">오류</Chip>;
  return <Chip>대기</Chip>;
}
