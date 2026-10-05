import type { Metadata } from 'next';
import { QuizContainer } from '@/components/quiz/quiz-container';
import { pageMetadata } from '@/lib/page-metadata';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;

const description =
  '4 kısa soruyu yanıtla; damak tadına, demleme yöntemine ve kavrum tercihine en yakın nitelikli kahveleri sıralayalım.';

export const metadata: Metadata = pageMetadata('Damak tadına göre kahve bul', description, '/quiz');

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:max-w-5xl lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">
          Fincanını bul
        </p>
        <h1 className="mt-3 font-display text-5xl leading-none text-ink">
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
