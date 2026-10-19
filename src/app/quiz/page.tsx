import type { Metadata } from 'next';
import { QuizContainer } from '@/components/quiz/quiz-container';
import { pageMetadata } from '@/lib/page-metadata';
import { JsonLd, breadcrumbList, webPage } from '@/components/layout/json-ld';
import { brand } from '@/lib/brand';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;

const description =
  '4 kısa soruyu yanıtla; damak tadına, demleme yöntemine ve kavrum tercihine en yakın nitelikli kahveleri sıralayalım.';

const title = 'Damak tadına göre kahve bul';

export const metadata: Metadata = pageMetadata(title, description, '/quiz');

export default function QuizPage() {
  return (
    <div className="page-shell section-space max-w-5xl">
      <JsonLd data={webPage(title, description, '/quiz')} />
      <JsonLd data={breadcrumbList([[brand.name, '/'], [title, '/quiz']])} />
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">
          Fincanını bul
        </p>
        <h1 className="mt-3 font-display text-title leading-none text-ink">
          Damak tadına göre kahve bul.
        </h1>
        <p className="mt-4 text-muted">
          4 kısa soruyu yanıtla; demleme rutinine ve sevdiğin tatlara en yakın kahveleri sıralayalım. Emin olmadığın adımda “Fark etmez” de.
        </p>
      </div>
      <div className="mt-10">
        <QuizContainer />
      </div>
    </div>
  );
}
