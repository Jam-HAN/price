import { getSupabaseAdmin } from '@/lib/supabase';
import { MarginManager } from './MarginManager';

export const dynamic = 'force-dynamic';

export default async function MarginsPage() {
  const sb = getSupabaseAdmin();
  const [{ data: margins }, { data: devices }] = await Promise.all([
    sb.from('price_device_margins').select('id, scope_type, device_id, series, margin_krw, updated_at').order('scope_type').order('updated_at', { ascending: false }),
    sb.from('price_devices').select('id, model_code, nickname, series').eq('active', true).order('nickname'),
  ]);

  // 시리즈 목록 (중복 제거)
  const seriesSet = new Set<string>();
  for (const d of devices ?? []) if (d.series) seriesSet.add(d.series);
  const seriesList = Array.from(seriesSet).sort();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">마진 설정</h1>
        <p className="mt-1 text-sm text-zinc-500">
          고객가 = Net가 + 마진. 우선순위: <span className="font-semibold">디바이스 &gt; 시리즈 &gt; 전역</span>.
          단위: 원 (예: 100000 = 10만원 마진).
        </p>
      </header>

      <MarginManager
        margins={margins ?? []}
        devices={devices ?? []}
        seriesList={seriesList}
      />
    </div>
  );
}
