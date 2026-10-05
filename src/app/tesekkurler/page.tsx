import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/lib/brand';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;
export const metadata: Metadata = { ...pageMetadata('Teşekkürler', 'Aboneliğini onaylamak için e-posta kutunu kontrol et ve kahve keşfine devam et.', '/tesekkurler'), robots: { index: false, follow: true } };
export default function ThankYouPage() {
  return <div className="page-shell py-16 sm:py-24" data-newsletter="done"><div className="max-w-2xl"><p className="eyebrow">{brand.monthlyName} · {brand.newsletterName}</p><h1 className="mt-5 font-display text-5xl">Güzel kahvelerde buluşalım.</h1><p className="mt-6 text-base leading-8 text-muted">Aboneliğini tamamlamak için e-posta kutuna gelecek onay iletisindeki bağlantıya tıkla; onaylamazsan e-posta göndermeyiz. Gelen kutusunda yoksa spam klasörüne de bakabilirsin. Ayda bir aylık bülteni, haftada bir fiyat özetini alırsın; her e-postadaki bağlantıyla istediğin an ayrılabilirsin.</p><div className="mt-8 flex flex-wrap gap-4"><Link href="/kahveler" className="button-dark">Kahveleri keşfet →</Link><Link href="/quiz" className="button-light">Damak tadımı bul ↗</Link></div></div></div>;
}
