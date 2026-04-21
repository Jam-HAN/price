'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatMan } from '@/lib/fmt';
import { toggleDeviceActive, bulkSetActive } from './actions';

type Device = {
  id: string;
  model_code: string;
  nickname: string;
  manufacturer: string | null;
  series: string | null;
  storage: string | null;
  retail_price_krw: number;
  category: string;
  display_order: number;
  active: boolean;
};

const SERIES_GROUPS: { key: string; label: string; series: (string | null)[] }[] = [
  { key: 'S26',      label: 'Galaxy S26',      series: ['galaxyS26'] },
  { key: 'Fold7',    label: 'Z Fold7 / Flip7', series: ['fold7', 'flip7'] },
  { key: 'S25',      label: 'Galaxy S25',      series: ['galaxyS25'] },
  { key: 'Fold6',    label: 'Z Fold6 / Flip6', series: ['fold6', 'flip6'] },
  { key: 'A',        label: 'Galaxy A / M',    series: ['galaxyEtc'] },
  { key: 'iPhone17', label: 'iPhone 17',       series: ['iphone17'] },
  { key: 'iPhoneAir',label: 'iPhone Air',      series: ['iphoneAir'] },
  { key: 'iPhone16', label: 'iPhone 16',       series: ['iphone16'] },
  { key: 'iPhone15', label: 'iPhone 15',       series: ['iphone15'] },
  { key: 'Tablet',   label: '태블릿',          series: ['tablet'] },
  { key: 'Watch',    label: '워치 / 링',       series: ['wearable'] },
  { key: 'Misc',     label: '기타',            series: ['misc', null] },
];

export function DeviceCurator({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const activeCount = devices.filter((d) => d.active).length;
  const totalCount = devices.length;

  const grouped = SERIES_GROUPS.map((g) => ({
    ...g,
    items: devices
      .filter((d) => g.series.includes(d.series))
      .sort((a, b) => a.display_order - b.display_order || a.nickname.localeCompare(b.nickname)),
  })).filter((g) => g.items.length > 0);

  function toggle(id: string, next: boolean) {
    start(async () => {
      await toggleDeviceActive({ id, active: next });
      router.refresh();
    });
  }
  function bulkSeries(series: (string | null)[], active: boolean) {
    const ids = devices.filter((d) => series.includes(d.series)).map((d) => d.id);
    start(async () => {
      await bulkSetActive({ ids, active });
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3">
        <div>
          <b>{activeCount}</b> <span className="text-zinc-500">/ {totalCount}</span>
          <span className="ml-2 text-xs text-zinc-500">활성 / 전체 — 판매중인 모델만 체크</span>
        </div>
        <div className="flex gap-2 text-xs">
          <button
            disabled={pending}
            onClick={() => start(async () => {
              await bulkSetActive({ ids: devices.map((d) => d.id), active: true });
              router.refresh();
            })}
            className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            전체 활성
          </button>
          <button
            disabled={pending}
            onClick={() => start(async () => {
              await bulkSetActive({ ids: devices.map((d) => d.id), active: false });
              router.refresh();
            })}
            className="rounded border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
          >
            전체 비활성
          </button>
        </div>
      </div>

      {grouped.map((g) => (
        <section key={g.key} className="rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2">
            <h2 className="text-sm font-semibold">
              {g.label} <span className="ml-1 text-xs font-normal text-zinc-500">({g.items.filter((i) => i.active).length}/{g.items.length})</span>
            </h2>
            <div className="flex gap-1 text-[11px]">
              <button
                disabled={pending}
                onClick={() => bulkSeries(g.series, true)}
                className="rounded border border-emerald-200 bg-white px-2 py-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                전부 활성
              </button>
              <button
                disabled={pending}
                onClick={() => bulkSeries(g.series, false)}
                className="rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
              >
                전부 비활성
              </button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white text-xs text-zinc-500">
              <tr>
                <th className="px-3 py-1.5 text-left w-20">판매</th>
                <th className="px-3 py-1.5 text-left">모델</th>
                <th className="px-3 py-1.5 text-left">코드</th>
                <th className="px-3 py-1.5 text-right">출고가</th>
                <th className="px-3 py-1.5 text-left">용량</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((d) => (
                <tr
                  key={d.id}
                  className={`border-t border-zinc-100 ${d.active ? '' : 'bg-zinc-50 text-zinc-400'}`}
                >
                  <td className="px-3 py-1.5">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={d.active}
                        disabled={pending}
                        onChange={(e) => toggle(d.id, e.currentTarget.checked)}
                        className="h-4 w-4"
                      />
                      <span className={`text-xs ${d.active ? 'text-emerald-700 font-semibold' : 'text-zinc-400'}`}>
                        {d.active ? '판매중' : '미취급'}
                      </span>
                    </label>
                  </td>
                  <td className="px-3 py-1.5 font-medium">{d.nickname}</td>
                  <td className="px-3 py-1.5 font-mono text-xs text-zinc-500">{d.model_code}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs">{formatMan(d.retail_price_krw)}만</td>
                  <td className="px-3 py-1.5 text-xs">{d.storage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
