'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upsertMargin, deleteMargin } from './actions';

type Margin = {
  id: string;
  scope_type: 'global' | 'series' | 'device';
  device_id: string | null;
  series: string | null;
  margin_krw: number;
  updated_at: string;
};
type Device = { id: string; model_code: string; nickname: string; series: string | null };

const SERIES_LABEL: Record<string, string> = {
  galaxyS26: '갤럭시 S26',
  galaxyS25: '갤럭시 S25',
  fold7: 'Z 폴드7',
  flip7: 'Z 플립7',
  fold6: 'Z 폴드6',
  flip6: 'Z 플립6',
  galaxyEtc: '갤럭시 A/M',
  iphone17: '아이폰 17',
  iphoneAir: '아이폰 AIR',
  iphone16: '아이폰 16',
  iphone15: '아이폰 15',
  tablet: '태블릿',
  wearable: '워치·링',
  misc: '기타',
};
const seriesLabel = (s: string) => SERIES_LABEL[s] ?? s;

export function MarginManager({
  margins,
  devices,
  seriesList,
}: {
  margins: Margin[];
  devices: Device[];
  seriesList: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const globalMargin = margins.find((m) => m.scope_type === 'global');
  const seriesMargins = margins.filter((m) => m.scope_type === 'series');
  const deviceMargins = margins.filter((m) => m.scope_type === 'device');

  const [newScope, setNewScope] = useState<'series' | 'device'>('series');
  const [newSeries, setNewSeries] = useState(seriesList[0] ?? '');
  const [newDevice, setNewDevice] = useState(devices[0]?.id ?? '');
  const [newAmount, setNewAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const deviceById = new Map(devices.map((d) => [d.id, d]));

  async function saveAmount(m: Margin, amountKrw: number) {
    start(async () => {
      await upsertMargin({
        scope_type: m.scope_type,
        device_id: m.device_id,
        series: m.series,
        margin_krw: amountKrw,
      });
      router.refresh();
    });
  }

  async function addNew() {
    setFormError(null);
    const n = Number(newAmount);
    if (!newAmount || !Number.isFinite(n)) {
      setFormError('마진 금액은 숫자로 입력하세요');
      return;
    }
    start(async () => {
      try {
        await upsertMargin({
          scope_type: newScope,
          device_id: newScope === 'device' ? newDevice : null,
          series: newScope === 'series' ? newSeries : null,
          margin_krw: n,
        });
        setNewAmount('');
        router.refresh();
      } catch (e) {
        setFormError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 전역 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">전역 마진 (global)</h2>
        <p className="mb-3 text-xs text-zinc-500">어디에도 해당 안 되는 경우 적용되는 기본값.</p>
        {globalMargin ? (
          <AmountEditor
            value={globalMargin.margin_krw}
            onSave={(v) => saveAmount(globalMargin, v)}
            pending={pending}
          />
        ) : (
          <div className="text-xs text-zinc-500">(전역 마진이 아직 없습니다)</div>
        )}
      </section>

      {/* 시리즈별 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">시리즈별 마진</h2>
        {seriesMargins.length === 0 ? (
          <div className="text-xs text-zinc-500">(시리즈별 마진 없음)</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-zinc-500">
              <tr><th className="text-left py-1">시리즈</th><th className="text-right">마진</th><th></th></tr>
            </thead>
            <tbody>
              {seriesMargins.map((m) => (
                <tr key={m.id} className="border-t border-zinc-100">
                  <td className="py-1">{m.series ? seriesLabel(m.series) : '—'} <span className="ml-1 font-mono text-zinc-400">({m.series})</span></td>
                  <td className="text-right">
                    <AmountEditor value={m.margin_krw} onSave={(v) => saveAmount(m, v)} pending={pending} />
                  </td>
                  <td className="text-right">
                    <button
                      disabled={pending}
                      onClick={() => start(async () => { await deleteMargin(m.id); router.refresh(); })}
                      className="text-red-500 hover:underline disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 디바이스별 */}
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">디바이스별 마진</h2>
        {deviceMargins.length === 0 ? (
          <div className="text-xs text-zinc-500">(디바이스별 마진 없음)</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-zinc-500">
              <tr><th className="text-left py-1">모델</th><th className="text-right">마진</th><th></th></tr>
            </thead>
            <tbody>
              {deviceMargins.map((m) => {
                const d = m.device_id ? deviceById.get(m.device_id) : null;
                return (
                  <tr key={m.id} className="border-t border-zinc-100">
                    <td className="py-1">
                      {d ? <><span className="font-medium">{d.nickname}</span> <span className="font-mono text-zinc-400">({d.model_code})</span></> : '?'}
                    </td>
                    <td className="text-right">
                      <AmountEditor value={m.margin_krw} onSave={(v) => saveAmount(m, v)} pending={pending} />
                    </td>
                    <td className="text-right">
                      <button
                        disabled={pending}
                        onClick={() => start(async () => { await deleteMargin(m.id); router.refresh(); })}
                        className="text-red-500 hover:underline disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* 추가 */}
      <section className="rounded-xl border border-dashed border-zinc-300 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold">마진 추가</h2>
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-zinc-500">범위</span>
            <select value={newScope} onChange={(e) => setNewScope(e.target.value as 'series' | 'device')}
              className="rounded border border-zinc-300 bg-white px-2 py-1.5">
              <option value="series">시리즈</option>
              <option value="device">디바이스</option>
            </select>
          </label>
          {newScope === 'series' ? (
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">시리즈</span>
              <select value={newSeries} onChange={(e) => setNewSeries(e.target.value)}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5">
                {seriesList.map((s) => <option key={s} value={s}>{seriesLabel(s)}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-zinc-500">디바이스</span>
              <select value={newDevice} onChange={(e) => setNewDevice(e.target.value)}
                className="rounded border border-zinc-300 bg-white px-2 py-1.5">
                {devices.map((d) => <option key={d.id} value={d.id}>{d.nickname} ({d.model_code})</option>)}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-zinc-500">마진 (원)</span>
            <input value={newAmount} onChange={(e) => setNewAmount(e.target.value)}
              placeholder="100000" className="w-32 rounded border border-zinc-300 bg-white px-2 py-1.5" />
          </label>
          <button disabled={pending} onClick={addNew}
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-white hover:bg-zinc-700 disabled:opacity-50">
            추가
          </button>
        </div>
        {formError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</div>
        ) : null}
      </section>
    </div>
  );
}

function AmountEditor({
  value,
  onSave,
  pending,
}: { value: number; onSave: (v: number) => void; pending: boolean }) {
  const [editing, setEditing] = useState(false);
  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className="cursor-pointer rounded px-2 py-0.5 font-mono hover:bg-zinc-100">
        {value.toLocaleString()}원
      </button>
    );
  }
  return (
    <input
      autoFocus
      defaultValue={value}
      disabled={pending}
      onBlur={(e) => {
        const n = Number(e.currentTarget.value);
        if (Number.isFinite(n)) onSave(n);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-28 rounded border border-zinc-300 bg-white px-2 py-0.5 text-right font-mono outline-none focus:border-zinc-500"
    />
  );
}
