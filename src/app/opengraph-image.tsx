import { ImageResponse } from 'next/og';

export const alt = 'TR CoffeeDB - Nitelikli Kahve Rehberi';

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
          background: '#fffdf8',
          color: '#1f1d1b',
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
            TR CoffeeDB
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
            <span>Yeni kahveni</span>
            <span>kolayca bul.</span>
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
            Türkiye&apos;deki nitelikli kahveleri güncel veri ve tarafsız filtrelerle keşfet.
          </div>
          <div
            style={{
              alignSelf: 'flex-start',
              background: '#ecff64',
              border: '2px solid #1f1d1b',
              borderRadius: 18,
              color: '#1f1d1b',
              display: 'flex',
              fontSize: 28,
              fontWeight: 800,
              padding: '18px 24px',
            }}
          >
            Kavurucunun fiyatıyla bak
          </div>
        </div>
      </div>
    ),
    size
  );
}
