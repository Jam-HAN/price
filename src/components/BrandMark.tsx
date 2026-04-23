/** 대박통신 단가표 시스템 로고 마크. 그라데이션 배경에 "대" 글자. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-[22%] font-extrabold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        background: 'linear-gradient(135deg, #2152ff, #7a9bff 60%, #d4ff3f)',
      }}
    >
      대
    </div>
  );
}
