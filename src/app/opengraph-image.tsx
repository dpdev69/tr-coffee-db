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
          background: '#f7f8f6',
          color: '#171a2b',
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
              color: '#c63d24',
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
              fontFamily: 'system-ui, sans-serif',
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
              color: '#555a6e',
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
              background: '#ffd9cf',
              border: '2px solid #2340c7',
              borderRadius: 18,
              color: '#171a2b',
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
