import type { Metadata } from 'next';
import { QuizContainer } from '@/components/quiz/quiz-container';
import { SITE_NAME } from '@/lib/site';

// Static copy: cacheable at the edge, re-rendered at most hourly (so a deploy shows within the hour).
export const revalidate = 3600;

const description =
  '4 kısa soruyu yanıtla; damak tadınıza, demleme yönteminize ve kavrum tercihinize uygun nitelikli kahveleri filtreleyelim.';

export const metadata: Metadata = {
  title: 'Damak Tadına Göre Kahve Bul',
  description,
  alternates: {
    canonical: '/quiz',
  },
  openGraph: {
    title: `Damak Tadına Göre Kahve Bul | ${SITE_NAME}`,
    description,
    url: '/quiz',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Damak Tadına Göre Kahve Bul | ${SITE_NAME}`,
    description,
  },
};

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="text-center">
        <p className="eyebrow">
          Fincanını bul
        </p>
        <h1 className="mt-3 font-display text-5xl leading-none text-ink">
          Damak tadına göre kahve bul.
        </h1>
        <p className="mt-4 text-muted">
          4 kısa soruyu yanıtla; demleme rutinine ve sevdiğin tatlara uyan kahveleri keşfet.
        </p>
      </div>
      <div className="mt-10">
        <QuizContainer />
      </div>
    </div>
  );
}
