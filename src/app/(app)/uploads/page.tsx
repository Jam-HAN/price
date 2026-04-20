export default function UploadsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">단가표 업로드</h1>
        <p className="mt-1 text-sm text-zinc-500">거래처 카카오 단가표 이미지 → Claude Vision 파싱 → 검수 → 저장.</p>
      </header>
      <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center text-sm text-zinc-500">
        Phase 2 — 업로드 + Vision 파싱 UI는 다음 단계에서 구현됩니다.
      </div>
    </div>
  );
}
