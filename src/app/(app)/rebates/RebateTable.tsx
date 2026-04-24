'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatMan } from '@/lib/fmt';
import { updateRebate } from './actions';

type Vendor = { id: string; name: string };
type Tier = { id: string; code: string };
type Device = { id: string; model_code: string; nickname: string };
type Rebate = {
  sheet_id: string; device_id: string; plan_tier_id: string;
  contract_type: 'common' | 'select';
  activation_type: 'new010' | 'mnp' | 'change';
  amount_krw: number;
};

export function RebateTable({
  carrier,
  vendors,
  tiers,
  devices,
  rebates,
  latestSheetByVendor,
}: {
  carrier: 'SKT' | 'KT' | 'LGU+';
  vendors: Vendor[];
  tiers: Tier[];
  devices: Device[];
  rebates: Rebate[];
  latestSheetByVendor: Record<string, string>;
}) {
  const [activeVendorId, setActiveVendorId] = useState(vendors[0]?.id ?? '');
  const activeSheetId = latestSheetByVendor[activeVendorId] ?? '';

  // 해당 거래처 리베이트만 필터 + Map 구성 (거래처 전환 시에만 재계산)
  const rebateMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rebates) {
      if (r.sheet_id !== activeSheetId) continue;
      m.set(`${r.device_id}|${r.plan_tier_id}|${r.contract_type}|${r.activation_type}`, r.amount_krw);
    }
    return m;
  }, [rebates, activeSheetId]);

  const segBtn = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs transition ${active ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'}`;

  // 공·010/MNP/기변 + 선·010/MNP/기변 순
  const COMBOS: { ct: 'common' | 'select'; at: 'new010' | 'mnp' | 'change'; label: string; dim?: boolean }[] = [
    { ct: 'common', at: 'new010', label: '공·010' },
    { ct: 'common', at: 'mnp',    label: '공·MNP' },
    { ct: 'common', at: 'change', label: '공·기변' },
    { ct: 'select', at: 'new010', label: '선·010', dim: true },
    { ct: 'select', at: 'mnp',    label: '선·MNP', dim: true },
    { ct: 'select', at: 'change', label: '선·기변', dim: true },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">거래처</span>
        {vendors.map((v) => (
          <button key={v.id} onClick={() => setActiveVendorId(v.id)} className={segBtn(activeVendorId === v.id)}>
            {v.name}
          </button>
        ))}
        {!activeSheetId && (
          <span className="ml-2 text-xs text-red-500">※ {vendors.find((v) => v.id === activeVendorId)?.name}: 확정 시트 없음</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-zinc-50 text-zinc-500">
            <tr>
              <th rowSpan={2} className="sticky left-0 bg-zinc-50 px-3 py-2 text-left">모델</th>
              {tiers.map((t) => (
                <th key={t.id} colSpan={COMBOS.length} className="border-l border-zinc-200 px-2 py-1 text-center text-[11px] font-bold">
                  {t.code}
                </th>
              ))}
            </tr>
            <tr>
              {tiers.map((t) =>
                COMBOS.map((c, i) => (
                  <th
                    key={`${t.id}-${c.ct}-${c.at}`}
                    className={`px-1 py-1 text-[10px] font-normal ${c.dim ? 'text-zinc-400' : ''}`}
                    style={{ borderLeft: i === 0 ? '1px solid rgb(228 228 231)' : undefined }}
                  >
                    {c.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.id} className="border-t border-zinc-100">
                <td className="sticky left-0 bg-white px-3 py-1.5 font-medium">
                  <div>{d.nickname}</div>
                  <div className="font-mono text-[10px] text-zinc-400">{d.model_code}</div>
                </td>
                {tiers.map((t) =>
                  COMBOS.map((c, i) => (
                    <EditCell
                      key={`${t.id}-${c.ct}-${c.at}`}
                      sheetId={activeSheetId}
                      deviceId={d.id}
                      tierId={t.id}
                      ct={c.ct}
                      at={c.at}
                      value={rebateMap.get(`${d.id}|${t.id}|${c.ct}|${c.at}`) ?? null}
                      dim={c.dim}
                      leftBorder={i === 0}
                    />
                  )),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditCell({
  sheetId,
  deviceId,
  tierId,
  ct,
  at,
  value,
  dim,
  leftBorder,
}: {
  sheetId: string;
  deviceId: string;
  tierId: string;
  ct: 'common' | 'select';
  at: 'new010' | 'mnp' | 'change';
  value: number | null;
  dim?: boolean;
  leftBorder?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [local, setLocal] = useState<number | null>(value);
  const [err, setErr] = useState<string | null>(null);

  const commit = (raw: string) => {
    if (!sheetId) return;
    setErr(null);
    const t = raw.trim();
    let next: number | null;
    if (t === '' || t === '-' || t === '—') next = null;
    else {
      const n = Number(t);
      if (!Number.isFinite(n)) { setErr('숫자 아님'); return; }
      next = Math.round(n * 10000); // 만원 → 원
    }
    if (next === local) { setEditing(false); return; }
    start(async () => {
      try {
        await updateRebate({
          sheet_id: sheetId, device_id: deviceId, plan_tier_id: tierId,
          contract_type: ct, activation_type: at, amount_krw: next,
        });
        setLocal(next);
        setEditing(false);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <td
      className={`px-1 py-1 text-right font-mono text-[11px] ${dim ? 'text-zinc-500' : ''}`}
      style={leftBorder ? { borderLeft: '1px solid rgb(228 228 231)' } : undefined}
    >
      {editing && sheetId ? (
        <input
          autoFocus
          defaultValue={local == null ? '' : formatMan(local)}
          disabled={pending}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditing(false);
          }}
          className="w-12 rounded border border-zinc-300 bg-white px-1 py-0.5 text-right outline-none focus:border-zinc-500"
        />
      ) : (
        <button
          type="button"
          onClick={() => sheetId && setEditing(true)}
          disabled={!sheetId}
          className={`w-full rounded px-0.5 ${sheetId ? 'cursor-pointer hover:bg-zinc-100' : 'cursor-not-allowed'} ${local == null ? 'text-zinc-300' : ''} ${local != null && local < 0 ? 'text-red-600' : ''}`}
        >
          {formatMan(local)}
        </button>
      )}
      {err ? <div className="text-[9px] text-red-600">{err}</div> : null}
    </td>
  );
}
