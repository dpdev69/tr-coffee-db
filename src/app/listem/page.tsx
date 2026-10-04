import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/page-metadata';
import { SavedListView } from '@/components/coffee/saved-list';
import { NewsletterForm } from '@/components/v2/newsletter-form';

// The list itself lives on the visitor's device; this shell is the same for everyone.
export const metadata: Metadata = { ...pageMetadata('Listem', 'Kaydettiğin kahveler ve kaydettiğinden beri fiyatları.', '/listem'), robots: { index: false, follow: true } };

export default function SavedPage() {
  return <div className="page-shell section-space max-w-3xl">
    <h1 className="mb-1.5 font-display text-[34px] sm:text-5xl">Listem</h1>
    <SavedListView />
    <NewsletterForm source="saved" variant="card" className="mt-10" title="Fiyat düşünce e-posta gelsin" description="Fiyatı düşen kahveleri haftalık fiyat özetinde gönderiyoruz. Listen bu cihazda kalır, e-postana bağlanmaz." />
  </div>;
}
