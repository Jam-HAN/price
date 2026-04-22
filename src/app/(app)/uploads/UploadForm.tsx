'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type CropSpec = { yRatio0: number; yRatio1: number; targetWidth: number };
type Vendor = {
  id: string;
  name: string;
  carrier: string;
  crop_spec: CropSpec | null;
};

const MAX_DIM = 2400;
const SAFE_BYTES = 4 * 1024 * 1024;
const DEFAULT_TARGET_WIDTH = 1500;

async function maybeResize(file: File): Promise<File> {
  if (file.size <= SAFE_BYTES) return file;
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('이미지 로드 실패'));
      img.src = url;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    if (scale >= 1 && file.size <= SAFE_BYTES) return file;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas context 불가');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png', 0.92));
    if (!blob) throw new Error('캔버스 인코딩 실패');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function UploadForm({ vendors }: { vendors: Vendor[] }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '');
  const [date, setDate] = useState(today);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId) ?? null,
    [vendors, vendorId],
  );

  // yRatio0/1, targetWidth 초기값은 벤더 crop_spec에서. 없으면 전체 영역(0~1)
  const [yRatio0, setYRatio0] = useState(0);
  const [yRatio1, setYRatio1] = useState(1);
  const [targetWidth, setTargetWidth] = useState(DEFAULT_TARGET_WIDTH);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [saveCrop, setSaveCrop] = useState(false);

  // 벤더 바뀌면 저장된 crop_spec 적용
  useEffect(() => {
    const spec = selectedVendor?.crop_spec;
    if (spec) {
      setYRatio0(spec.yRatio0);
      setYRatio1(spec.yRatio1);
      setTargetWidth(spec.targetWidth);
      setCropEnabled(true);
    } else {
      setYRatio0(0);
      setYRatio1(1);
      setTargetWidth(DEFAULT_TARGET_WIDTH);
      setCropEnabled(false);
    }
    setSaveCrop(false);
  }, [selectedVendor]);

  function onFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !vendorId) return;
    setBusy(true);
    setError(null);
    try {
      const resized = await maybeResize(file);
      const fd = new FormData();
      fd.set('vendor_id', vendorId);
      fd.set('effective_date', date);
      fd.set('file', resized);
      if (cropEnabled && (yRatio0 > 0 || yRatio1 < 1)) {
        fd.set('crop_spec', JSON.stringify({ yRatio0, yRatio1, targetWidth }));
        if (saveCrop) fd.set('save_crop_spec', '1');
      }
      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      router.push(`/uploads/${json.sheet_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-xs text-zinc-600">
          거래처
          <select
            required
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="mt-1 w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.carrier})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-zinc-600">
          적용 일자
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-zinc-600">단가표 이미지 (PNG/JPG/WebP, 20MB 이하)</span>
        <div className="mt-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          {file ? <p className="mt-2 text-xs text-zinc-600">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p> : null}
        </div>
      </label>

      {preview ? (
        <CropEditor
          src={preview}
          yRatio0={yRatio0}
          yRatio1={yRatio1}
          targetWidth={targetWidth}
          enabled={cropEnabled}
          saveDefault={saveCrop}
          hasSavedDefault={!!selectedVendor?.crop_spec}
          onChange={(spec) => {
            setYRatio0(spec.yRatio0);
            setYRatio1(spec.yRatio1);
            setTargetWidth(spec.targetWidth);
          }}
          onToggleEnabled={setCropEnabled}
          onToggleSave={setSaveCrop}
        />
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!file || !vendorId || busy}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? '파싱 중 (최대 1분)…' : '업로드 + CLOVA 파싱'}
        </button>
        {busy ? <span className="text-xs text-zinc-500">CLOVA가 표를 읽고 있어요.</span> : null}
      </div>
    </form>
  );
}

/**
 * 이미지 위에 드래그 가능한 상/하 핸들을 띄워 모델표 y 범위만 선택.
 * 가로는 항상 원본 전체(0~1)로 고정, 세로만 yRatio0/1 조정.
 */
function CropEditor({
  src,
  yRatio0,
  yRatio1,
  targetWidth,
  enabled,
  saveDefault,
  hasSavedDefault,
  onChange,
  onToggleEnabled,
  onToggleSave,
}: {
  src: string;
  yRatio0: number;
  yRatio1: number;
  targetWidth: number;
  enabled: boolean;
  saveDefault: boolean;
  hasSavedDefault: boolean;
  onChange: (spec: CropSpec) => void;
  onToggleEnabled: (v: boolean) => void;
  onToggleSave: (v: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'top' | 'bottom' | null>(null);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
      if (dragging === 'top') {
        onChange({ yRatio0: Math.min(y, yRatio1 - 0.05), yRatio1, targetWidth });
      } else {
        onChange({ yRatio0, yRatio1: Math.max(y, yRatio0 + 0.05), targetWidth });
      }
    }
    function onUp() { setDragging(null); }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, yRatio0, yRatio1, targetWidth, onChange]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs">
        <label className="inline-flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
          />
          <span className="font-medium">크롭 영역 지정</span>
          {hasSavedDefault ? <span className="text-emerald-700">· 저장된 기본값 적용 중</span> : null}
        </label>
        {enabled ? (
          <>
            <span className="text-zinc-600">
              y: <b className="mono">{(yRatio0 * 100).toFixed(1)}%</b> ~ <b className="mono">{(yRatio1 * 100).toFixed(1)}%</b>
            </span>
            <label className="inline-flex items-center gap-1">
              <span className="text-zinc-600">가로:</span>
              <input
                type="number"
                min={800}
                max={2400}
                step={100}
                value={targetWidth}
                onChange={(e) => onChange({ yRatio0, yRatio1, targetWidth: Number(e.target.value) || DEFAULT_TARGET_WIDTH })}
                className="w-20 rounded border border-zinc-300 px-1.5 py-0.5 text-xs"
              />
              <span className="text-zinc-500">px</span>
            </label>
            <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={saveDefault} onChange={(e) => onToggleSave(e.target.checked)} />
              <span className="text-zinc-700">이 값을 거래처 기본값으로 저장</span>
            </label>
          </>
        ) : (
          <span className="text-zinc-500">크롭 없이 원본 그대로 전송 (SKT처럼 세로가 긴 단가표는 지정 권장)</span>
        )}
      </div>

      <div
        ref={containerRef}
        className="relative mx-auto max-h-[500px] select-none overflow-hidden"
        style={{ width: 'fit-content', touchAction: 'none' }}
      >
        <img src={src} alt="미리보기" className="block max-h-[500px] object-contain" draggable={false} />
        {enabled ? (
          <>
            {/* 상단 어둡게 */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 bg-black/50"
              style={{ height: `${yRatio0 * 100}%` }}
            />
            {/* 하단 어둡게 */}
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50"
              style={{ height: `${(1 - yRatio1) * 100}%` }}
            />
            {/* 상단 핸들 */}
            <div
              onPointerDown={(e) => { e.preventDefault(); setDragging('top'); }}
              className="absolute inset-x-0 z-10 flex cursor-ns-resize items-center"
              style={{ top: `calc(${yRatio0 * 100}% - 6px)`, height: 12 }}
            >
              <div className="h-0.5 w-full bg-lime-400" />
              <div className="absolute left-1/2 -translate-x-1/2 rounded bg-lime-400 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-900 shadow">
                TOP {(yRatio0 * 100).toFixed(1)}%
              </div>
            </div>
            {/* 하단 핸들 */}
            <div
              onPointerDown={(e) => { e.preventDefault(); setDragging('bottom'); }}
              className="absolute inset-x-0 z-10 flex cursor-ns-resize items-center"
              style={{ top: `calc(${yRatio1 * 100}% - 6px)`, height: 12 }}
            >
              <div className="h-0.5 w-full bg-lime-400" />
              <div className="absolute left-1/2 -translate-x-1/2 rounded bg-lime-400 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-900 shadow">
                BOTTOM {(yRatio1 * 100).toFixed(1)}%
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
