import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sayfa bulunamadı',
  description: 'Aradığın sayfa taşınmış veya kaldırılmış olabilir. Kahve kataloğuna dön ya da damak tadına göre bir kahve keşfet.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="page-shell flex min-h-[60vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">404 · Sayfa bulunamadı</p>
      <h1 className="mt-5 max-w-2xl font-display text-5xl leading-[1.08] sm:text-6xl">Bu sayfayı bulamadık.</h1>
      <p className="mt-6 max-w-lg text-base leading-8 text-[#706354]">Bağlantı değişmiş veya sayfa kaldırılmış olabilir. Bir sonraki güzel kahveni bulmak için keşfe devam edebilirsin.</p>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Link href="/kahveler" className="button-dark">Kahveleri keşfet <span aria-hidden="true">↗</span></Link>
        <Link href="/" className="text-link">Ana sayfaya dön →</Link>
      </div>
    </section>
  );
}
