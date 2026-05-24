'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  buildQuizFilterResult,
  createInitialQuizAnswers,
  QUIZ_STEPS,
  type QuizAnswers,
  type QuizArrayAnswerKey,
  type QuizStep,
} from '@/lib/quiz-filters';

export function QuizContainer() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(createInitialQuizAnswers);
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  const isComplete = stepIndex >= QUIZ_STEPS.length;
  const current = QUIZ_STEPS[Math.min(stepIndex, QUIZ_STEPS.length - 1)];
  const isLastStep = stepIndex === QUIZ_STEPS.length - 1;
  const result = useMemo(() => buildQuizFilterResult(answers), [answers]);
  const selectedValues = getSelectedValues(current, answers);
  const selectedCount = selectedValues.length;

  useEffect(() => {
    if (stepIndex === 0) return;

    cardRef.current?.scrollIntoView({ block: 'start' });
    questionRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  function toggleOption(value: string) {
    const key = current.id;

    setAnswers((prev) => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value];

      return { ...prev, [key]: nextValues };
    });
  }

  function advanceStep() {
    if (isLastStep) {
      setStepIndex(QUIZ_STEPS.length);
    } else {
      setStepIndex((index) => index + 1);
    }
  }

  function resetCurrentStep() {
    setAnswers((prev) => ({ ...prev, [current.id]: [] }));
  }

  function resetQuiz() {
    setStepIndex(0);
    setAnswers(createInitialQuizAnswers());
  }

  if (isComplete) {
    return (
      <div
        ref={cardRef}
        className="scroll-mt-28 rounded-[24px] border border-[#1f1d1b]/10 bg-white p-5 text-center sm:p-8"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ecff64] text-[#1f1d1b]">
          <CheckIcon />
        </div>
        <h2 className="mt-4 font-display text-3xl leading-none text-[#1f1d1b]">
          Tercihlerine göre listeyi hazırladık.
        </h2>
        <p className="mt-2 text-[#5d5853]">
          Seçimlerin doğrudan katalog filtrelerine çevrildi.
        </p>
        {result.explanations.length > 0 && (
          <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-[#1f1d1b]/10 bg-[#fffdf8] p-4 text-left">
            <h3 className="text-sm font-semibold text-[#1f1d1b]">
              Uygulanacak filtreler
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-[#5d5853]">
              {result.explanations.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1f1d1b]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.explanations.length === 0 && (
          <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-[#1f1d1b]/10 bg-[#fffdf8] p-4 text-sm text-[#5d5853]">
            Filtre seçmedin; katalogdaki tüm güncel kahveleri göstereceğiz.
          </p>
        )}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={result.url}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1f1d1b] px-6 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Kahveleri Göster
            <ArrowRightIcon />
          </Link>
          <button
            type="button"
            onClick={resetQuiz}
            className="inline-flex items-center justify-center rounded-lg border border-[#1f1d1b] px-6 py-3 text-sm font-semibold text-[#1f1d1b] hover:bg-[#f6f1e8]"
          >
            Tercihleri Yeniden Seç
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={cardRef} className="scroll-mt-28 rounded-[24px] border border-[#1f1d1b]/10 bg-white p-5 sm:p-6">
      <div className="mb-7">
        <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#1f1d1b]/45">
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
                index <= stepIndex ? 'bg-[#1f1d1b]' : 'bg-[#1f1d1b]/10'
              }`}
            />
          ))}
        </div>
      </div>

      <h2
        ref={questionRef}
        tabIndex={-1}
        className="font-display text-3xl leading-none text-[#1f1d1b] focus:outline-none"
      >
        {current.question}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#5d5853]">{current.helper}</p>

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
                  ? 'border-[#1f1d1b] bg-[#ecff64] text-[#1f1d1b]'
                  : 'border-[#1f1d1b]/12 bg-white text-[#1f1d1b] hover:border-[#1f1d1b]/30 hover:bg-[#f6f1e8]'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-[#1f1d1b] bg-[#1f1d1b] text-white'
                    : 'border-[#1f1d1b]/25 bg-white text-transparent'
                }`}
                aria-hidden="true"
              >
                <SmallCheckIcon />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-5">{opt.label}</span>
                {opt.description && (
                  <span className="mt-1 block text-xs leading-5 text-[#5d5853]">
                    {opt.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex min-h-8 items-center justify-between gap-3 text-sm">
        <span className="text-[#5d5853]">
          {selectedCount > 0
            ? `${selectedCount} seçim eklendi`
            : 'Seçim yapmadan devam edebilirsin'}
        </span>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={resetCurrentStep}
            className="font-semibold text-[#1f1d1b] underline-offset-4 hover:underline"
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
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-[#1f1d1b]/70 hover:bg-[#f6f1e8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeftIcon />
          Geri
        </button>
        <button
          type="button"
          onClick={advanceStep}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1d1b] px-6 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          {isLastStep ? 'Sonuçları Gör' : 'İleri'}
          <ArrowRightIcon />
        </button>
      </div>
    </div>
  );
}

function getSelectedValues(step: QuizStep, answers: QuizAnswers) {
  return answers[step.id as QuizArrayAnswerKey];
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
