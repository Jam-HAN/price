'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function FullReparseButton({
  sheetId,
  model,
  label,
  color = 'emerald',
}: {
  sheetId: string;
  model: 'gemini' | 'claude';
  label: string;
  color?: 'emerald' | 'sky';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  async function run() {
    if (!confirm(`${label} — 전체 모델을 다시 파싱합니다. 현재 파싱 결과가 덮어씌워집니다. 진행할까요?`)) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/uploads/${sheetId}/full-reparse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDone(json.parsed_models ?? 0);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const palette =
    color === 'sky'
      ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'
      : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={run}
        disabled={busy}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${palette}`}
      >
        {busy ? `재파싱 중 (${model})…` : label}
      </button>
      {error ? <div className="text-[11px] text-red-600">{error}</div> : null}
      {done !== null ? <div className="text-[11px] text-emerald-700">✓ {done}개 모델 재파싱 완료</div> : null}
    </div>
  );
}
