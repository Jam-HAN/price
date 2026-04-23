import Image from 'next/image';

/** 대박통신 공식 심볼. 밝은 배경/어두운 배경 양쪽에서 보이도록 흰 원형 배지 안에 얹는다. */
export function BrandMark({ size = 32, bare = false }: { size?: number; bare?: boolean }) {
  const inner = Math.round(size * 0.78);
  if (bare) {
    return (
      <Image
        src="/logo-dbphone.png"
        alt="대박통신"
        width={size}
        height={size}
        priority
      />
    );
  }
  return (
    <div
      className="grid place-items-center overflow-hidden bg-white"
      style={{ width: size, height: size, borderRadius: size * 0.22 }}
    >
      <Image
        src="/logo-dbphone.png"
        alt="대박통신"
        width={inner}
        height={inner}
        priority
      />
    </div>
  );
}
