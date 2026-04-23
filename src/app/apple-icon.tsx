import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 110,
          fontWeight: 900,
          color: '#fff',
          borderRadius: 40,
          background: 'linear-gradient(135deg, #2152ff, #7a9bff 60%, #d4ff3f)',
        }}
      >
        대
      </div>
    ),
    size,
  );
}
