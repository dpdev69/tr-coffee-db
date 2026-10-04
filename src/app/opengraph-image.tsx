import { ImageResponse } from 'next/og';
import { brand } from '@/lib/brand';

export const alt = brand.title;

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background: '#faf4e9',
          color: '#30251f',
          display: 'flex',
          height: '100%',
          justifyContent: 'center',
          padding: '72px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '34px',
            width: '100%',
          }}
        >
          <div
            style={{
              color: '#7c3a20',
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 0,
            }}
          >
            {brand.name}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontFamily: 'Georgia, Times New Roman, serif',
              fontSize: 92,
              fontWeight: 500,
              letterSpacing: 0,
              lineHeight: 0.96,
            }}
          >
            <span>Bir sonraki</span>
            <span>kahveni keşfet.</span>
          </div>
          <div
            style={{
              color: '#5d5853',
              display: 'flex',
              fontSize: 32,
              lineHeight: 1.32,
              maxWidth: 820,
            }}
          >
            Bağımsız kavurucular. Yeni tatlar. Sana uygun bir fincan.
          </div>
          <div
            style={{
              alignSelf: 'flex-start',
              background: '#dec4a5',
              border: '2px solid #a6774c',
              borderRadius: 18,
              color: '#30251f',
              display: 'flex',
              fontSize: 28,
              fontWeight: 800,
              padding: '18px 24px',
            }}
          >
            Kahveni kavurucusundan keşfet
          </div>
        </div>
      </div>
    ),
    size
  );
}
