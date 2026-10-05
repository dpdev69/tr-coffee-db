import { pageMetadata } from '@/lib/page-metadata';
import type { Metadata } from 'next';
import Link from 'next/link';
import { brand } from '@/lib/brand';
import { signupsEnabled } from '@/lib/signups';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;
export const metadata: Metadata = { ...pageMetadata('Teşekkürler', signupsEnabled() ? 'Aboneliğini onaylamak için e-posta kutunu kontrol et ve kahve keşfine devam et.' : 'Bülten kayıtları şu anda kapalı. Kahve keşfine devam et.', '/tesekkurler'), robots: { index: false, follow: true } };
export default function ThankYouPage() {
  const on = signupsEnabled();
  return <div className="page-shell py-16 sm:py-24" data-newsletter="done"><div className="max-w-2xl"><p className="eyebrow">{on ? `${brand.monthlyName} · ${brand.newsletterName}` : brand.name}</p><h1 className="mt-5 font-display text-5xl">{on ? 'Güzel kahvelerde buluşalım.' : 'Şu an abonelik almıyoruz.'}</h1><p className="mt-6 text-base leading-8 text-muted">{on ? 'Aboneliğini tamamlamak için e-posta kutuna gelecek onay iletisindeki bağlantıya tıkla; onaylamazsan e-posta göndermeyiz. Gelen kutusunda yoksa spam klasörüne de bakabilirsin. Ayda bir aylık bülteni, haftada bir fiyat özetini alırsın; her e-postadaki bağlantıyla istediğin an ayrılabilirsin.' : 'Bülten kayıtları şu anda kapalı; e-posta adresi toplamıyoruz. Kahveleri keşfetmeye devam edebilirsin.'}</p><div className="mt-8 flex flex-wrap gap-4"><Link href="/kahveler" className="button-dark">Kahveleri keşfet →</Link><Link href="/quiz" className="button-light">Damak tadımı bul ↗</Link></div></div></div>;
}
