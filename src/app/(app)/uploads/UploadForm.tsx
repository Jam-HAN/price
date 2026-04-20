'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Vendor = { id: string; name: string; carrier: string };

const MAX_DIM = 2400;
const SAFE_BYTES = 4 * 1024 * 1024;

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
        <div className="rounded-xl border border-zinc-200 bg-white p-2">
          <img src={preview} alt="미리보기" className="mx-auto max-h-[500px] object-contain" />
        </div>
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
          {busy ? '파싱 중 (최대 1분)…' : '업로드 + Vision 파싱'}
        </button>
        {busy ? <span className="text-xs text-zinc-500">Claude Vision이 이미지를 읽고 있어요.</span> : null}
      </div>
    </form>
  );
}
