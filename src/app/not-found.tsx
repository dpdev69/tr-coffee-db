import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  // A missing page names no canonical (the layout's default would point at the home page).
  alternates: { canonical: null },
  // Overrides the layout's production `index, follow`, which would otherwise sit beside the framework's own 404 `noindex`.
  robots: { index: false, follow: true },
  title: 'Sayfa bulunamadı',
  description: 'Aradığın sayfa taşınmış veya kaldırılmış olabilir. Kahve kataloğuna dön ya da damak tadına göre bir kahve keşfet.',
};

export default function NotFound() {
  return (
    <section className="page-shell flex min-h-[60vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">404 · Sayfa bulunamadı</p>
      <h1 className="mt-5 max-w-2xl font-display text-title">Bu sayfayı bulamadık.</h1>
      <p className="mt-6 max-w-lg text-base leading-8 text-muted">Bağlantı değişmiş veya sayfa kaldırılmış olabilir. Bir sonraki güzel kahveni bulmak için keşfe devam edebilirsin.</p>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <Link href="/kahveler" className="button-dark">Kahveleri keşfet <span aria-hidden="true">↗</span></Link>
        <Link href="/" className="text-link">Ana sayfaya dön →</Link>
      </div>
    </section>
  );
}
