'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatMan } from '@/lib/fmt';
import { updateCarrierSubsidy } from './actions';

type Device = { id: string; model_code: string; nickname: string; series: string | null; retail_price_krw: number };
type Tier = { id: string; code: string; label: string };
type Sub = { device_id: string; plan_tier_id: string; subsidy_krw: number };

export function SubsidyTable({
  carrier,
  bundle,
}: {
  carrier: 'SKT' | 'KT' | 'LGU+';
  bundle: { devices: Device[]; tiers: Tier[]; subsidies: Sub[] };
}) {
  const { devices, tiers, subsidies } = bundle;

  const map = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of subsidies) m.set(`${s.device_id}|${s.plan_tier_id}`, s.subsidy_krw);
    return m;
  }, [subsidies]);

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr>
              <th
                className="sticky left-0 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider"
                style={{ background: '#fafbff', color: 'var(--ink-3)', borderBottom: '1px solid var(--line)' }}
              >
                모델
              </th>
              <th
                className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider"
                style={{ background: '#fafbff', color: 'var(--ink-3)', borderBottom: '1px solid var(--line)' }}
              >
                출고가
              </th>
              {tiers.map((t) => (
                <th
                  key={t.id}
                  className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider"
                  style={{ background: '#fafbff', color: 'var(--ink-3)', borderBottom: '1px solid var(--line)' }}
                  title={t.label}
                >
                  {t.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={tiers.length + 2} className="py-16 text-center" style={{ color: 'var(--ink-3)' }}>
                  활성 모델이 없습니다.
                </td>
              </tr>
            ) : null}
            {devices.map((d) => (
              <tr key={d.id} style={{ borderTop: '1px solid var(--line-2)' }}>
                <td className="sticky left-0 bg-white px-4 py-2">
                  <div className="text-[13px] font-semibold">{d.nickname}</div>
                  <div className="mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
                    {d.model_code}
                  </div>
                </td>
                <td className="mono px-3 py-2 text-right text-[12px]" style={{ color: 'var(--ink-3)' }}>
                  {formatMan(d.retail_price_krw)}
                </td>
                {tiers.map((t) => (
                  <SubsidyCell
                    key={t.id}
                    carrier={carrier}
                    deviceId={d.id}
                    tierId={t.id}
                    value={map.get(`${d.id}|${t.id}`) ?? null}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubsidyCell({
  carrier,
  deviceId,
  tierId,
  value,
}: {
  carrier: 'SKT' | 'KT' | 'LGU+';
  deviceId: string;
  tierId: string;
  value: number | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<number | null>(value);
  const [err, setErr] = useState<string | null>(null);

  const commit = (raw: string) => {
    setErr(null);
    const t = raw.trim();
    let next: number | null;
    if (t === '' || t === '-') next = null;
    else {
      const n = Number(t);
      if (!Number.isFinite(n)) {
        setErr('숫자 아님');
        return;
      }
      // 입력은 만원 단위. DB는 원 단위.
      next = Math.round(n * 10000);
    }
    if (next === local) {
      setEditing(false);
      return;
    }
    start(async () => {
      try {
        await updateCarrierSubsidy({ carrier, device_id: deviceId, plan_tier_id: tierId, subsidy_krw: next });
        setLocal(next);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <td className="px-1 py-1 text-center font-mono text-[11px]">
      {editing ? (
        <input
          autoFocus
          defaultValue={local == null ? '' : formatMan(local)}
          disabled={pending}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-14 rounded border border-zinc-300 bg-white px-1 py-0.5 text-right outline-none focus:border-zinc-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`w-full cursor-pointer rounded px-1 py-0.5 hover:bg-zinc-100 ${local == null ? 'text-zinc-300' : ''}`}
        >
          {formatMan(local)}
        </button>
      )}
      {err ? <div className="text-[9px] text-red-600">{err}</div> : null}
    </td>
  );
}
