import type { Metadata } from 'next';
import { QuizContainer } from '@/components/quiz/quiz-container';

export const metadata: Metadata = {
  title: 'Coffee Matchmaker',
  description:
    'Answer 5 quick questions and we\'ll find the perfect Turkish specialty coffee for you.',
};

export default function QuizPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-stone-900">Coffee Matchmaker</h1>
        <p className="mt-3 text-stone-500">
          Answer 5 quick questions and we&apos;ll find your perfect match.
        </p>
      </div>
      <div className="mt-10">
        <QuizContainer />
      </div>
    </div>
  );
}
