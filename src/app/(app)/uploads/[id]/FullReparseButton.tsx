'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/components/ConfirmDialog';

export function FullReparseButton({ sheetId }: { sheetId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [confirm, dialog] = useConfirmDialog();

  async function run() {
    const ok = await confirm({
      title: 'CLOVA 재파싱을 진행할까요?',
      description: '현재 이미지를 OCR로 다시 파싱합니다. 기존 파싱 결과가 덮어씌워집니다.',
      confirmLabel: '재파싱',
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/uploads/${sheetId}/full-reparse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <div className="flex flex-col gap-1">
      {dialog}
      <button
        onClick={run}
        disabled={busy}
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? '재파싱 중…' : 'CLOVA 재파싱'}
      </button>
      {error ? <div className="text-[11px] text-red-600">{error}</div> : null}
      {done !== null ? <div className="text-[11px] text-emerald-700">✓ {done}개 모델 재파싱 완료</div> : null}
    </div>
  );
}
