import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = { ...pageMetadata('Teşekkürler', 'Haftalık Drop başvurunun ardından e-posta kutunu kontrol et ve kahve keşfine devam et.', '/tesekkurler'), robots: { index: false, follow: true } };
export default function ThankYouPage() {
  return <div className="page-shell py-16 sm:py-24"><div className="max-w-2xl"><p className="eyebrow">Haftalık Drop</p><h1 className="mt-5 font-display text-5xl">Güzel kahvelerde buluşalım.</h1><p className="mt-6 text-base leading-8 text-muted">Başvurunu gönderdiysen e-posta kutunu kontrol et. Onay e-postası geldiyse bağlantıya tıklayarak aboneliğini tamamla. Gelen kutusunda yoksa spam klasörüne de bakabilirsin.</p><div className="mt-8 flex flex-wrap gap-4"><Link href="/kahveler" className="button-dark">Kahveleri keşfet →</Link><Link href="/quiz" className="button-light">Damak tadımı bul ↗</Link></div></div></div>;
}
