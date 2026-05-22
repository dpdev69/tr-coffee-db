'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  buildQuizFilterResult,
  createInitialQuizAnswers,
  QUIZ_STEPS,
  type QuizAnswers,
  type QuizArrayAnswerKey,
  type QuizPricePer100g,
  type QuizStep,
} from '@/lib/quiz-filters';

export function QuizContainer() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(createInitialQuizAnswers);

  const isComplete = stepIndex >= QUIZ_STEPS.length;
  const current = QUIZ_STEPS[Math.min(stepIndex, QUIZ_STEPS.length - 1)];
  const isLastStep = stepIndex === QUIZ_STEPS.length - 1;
  const result = useMemo(() => buildQuizFilterResult(answers), [answers]);
  const selectedValues = getSelectedValues(current, answers);
  const selectedCount = selectedValues.length;

  function toggleOption(value: string) {
    if (current.selection === 'multiple') {
      const key = current.id;

      setAnswers((prev) => {
        const nextValues = prev[key].includes(value)
          ? prev[key].filter((item) => item !== value)
          : [...prev[key], value];

        return { ...prev, [key]: nextValues };
      });
      return;
    }

    setAnswers((prev) => ({
      ...prev,
      pricePer100g:
        prev.pricePer100g === value ? null : (value as QuizPricePer100g),
    }));
  }

  function advanceStep() {
    if (isLastStep) {
      setStepIndex(QUIZ_STEPS.length);
    } else {
      setStepIndex((index) => index + 1);
    }
  }

  function resetCurrentStep() {
    if (current.selection === 'multiple') {
      setAnswers((prev) => ({ ...prev, [current.id]: [] }));
    } else {
      setAnswers((prev) => ({ ...prev, pricePer100g: null }));
    }
  }

  function resetQuiz() {
    setStepIndex(0);
    setAnswers(createInitialQuizAnswers());
  }

  if (isComplete) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckIcon />
        </div>
        <h2 className="mt-4 text-xl font-bold text-stone-900">
          Tercihlerine göre listeyi hazırladık.
        </h2>
        <p className="mt-2 text-stone-500">
          Seçimlerin doğrudan katalog filtrelerine çevrildi.
        </p>
        {result.explanations.length > 0 && (
          <div className="mx-auto mt-5 max-w-xl rounded-xl border border-stone-200 bg-stone-50 p-4 text-left">
            <h3 className="text-sm font-semibold text-stone-900">
              Uygulanacak filtreler
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-stone-600">
              {result.explanations.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.explanations.length === 0 && (
          <p className="mx-auto mt-5 max-w-xl rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
            Filtre seçmedin; katalogdaki tüm güncel kahveleri göstereceğiz.
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={result.url}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Kahveleri Göster
            <ArrowRightIcon />
          </Link>
          <button
            type="button"
            onClick={resetQuiz}
            className="inline-flex items-center justify-center rounded-lg border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Tercihleri Yeniden Seç
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-7">
        <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-wide text-stone-400">
          <span>
            Soru {stepIndex + 1} / {QUIZ_STEPS.length}
          </span>
          <span>{selectedCount > 0 ? `${selectedCount} seçim` : 'Opsiyonel'}</span>
        </div>
        <div className="mt-3 flex gap-1">
          {QUIZ_STEPS.map((stepItem, index) => (
            <div
              key={stepItem.id}
              className={`h-1.5 flex-1 rounded-full ${
                index <= stepIndex ? 'bg-amber-500' : 'bg-stone-200'
              }`}
            />
          ))}
        </div>
      </div>

      <h2 className="text-xl font-bold text-stone-900">{current.question}</h2>
      <p className="mt-2 text-sm leading-6 text-stone-500">{current.helper}</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {current.options.map((opt) => {
          const isSelected = selectedValues.includes(opt.value);

          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggleOption(opt.value)}
              aria-pressed={isSelected}
              className={`flex min-h-[96px] items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors ${
                isSelected
                  ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-sm'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-stone-300 bg-white text-transparent'
                }`}
                aria-hidden="true"
              >
                <SmallCheckIcon />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">{opt.label}</span>
                {opt.description && (
                  <span className="mt-1 block text-xs leading-5 text-stone-500">
                    {opt.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex min-h-8 items-center justify-between gap-3 text-sm">
        <span className="text-stone-500">
          {selectedCount > 0
            ? `${selectedCount} seçim eklendi`
            : 'Seçim yapmadan devam edebilirsin'}
        </span>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={resetCurrentStep}
            className="font-medium text-amber-700 hover:text-amber-800"
          >
            Bu adımı temizle
          </button>
        )}
      </div>

      <div className="mt-8 flex justify-between gap-3">
        <button
          type="button"
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
          disabled={stepIndex === 0}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeftIcon />
          Geri
        </button>
        <button
          type="button"
          onClick={advanceStep}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          {isLastStep ? 'Sonuçları Gör' : 'İleri'}
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

function getSelectedValues(step: QuizStep, answers: QuizAnswers) {
  if (step.selection === 'multiple') {
    return answers[step.id as QuizArrayAnswerKey];
  }

  return answers.pricePer100g ? [answers.pricePer100g] : [];
}

function CheckIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function SmallCheckIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="3"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6 6-6-6 6-6" />
    </svg>
  );
}
