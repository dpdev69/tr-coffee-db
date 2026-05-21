import { ImageResponse } from 'next/og';

export const alt = 'TR CoffeeDB - Nitelikli Kahve Karşılaştırma';

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
          background: 'linear-gradient(135deg, #1c1917 0%, #292524 48%, #0c0a09 100%)',
          color: '#fafaf9',
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
              color: '#f59e0b',
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: 0,
            }}
          >
            TR CoffeeDB
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: 86,
              fontWeight: 900,
              letterSpacing: 0,
              lineHeight: 0.96,
            }}
          >
            <span>Yeni kahveni</span>
            <span style={{ color: '#fbbf24' }}>20 sekmede arama.</span>
          </div>
          <div
            style={{
              color: '#d6d3d1',
              display: 'flex',
              fontSize: 32,
              lineHeight: 1.32,
              maxWidth: 820,
            }}
          >
            Türkiye&apos;deki nitelikli kahveleri güncel veri ve 100 g fiyatıyla karşılaştır.
          </div>
        </div>
      </div>
    ),
    size
  );
}
