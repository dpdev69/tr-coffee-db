'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { trackProductEvent } from '@/lib/product-events';
import {
  buildQuizFilterResult,
  createInitialQuizAnswers,
  hasQuizSelections,
  QUIZ_STEPS,
  type QuizAnswers,
  type QuizArrayAnswerKey,
  type QuizStep,
} from '@/lib/quiz-filters';

export function QuizContainer() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(createInitialQuizAnswers);
  const started = useRef(false);
  const mounted = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  const isComplete = stepIndex >= QUIZ_STEPS.length;
  const current = QUIZ_STEPS[Math.min(stepIndex, QUIZ_STEPS.length - 1)];
  const isLastStep = stepIndex === QUIZ_STEPS.length - 1;
  const result = useMemo(() => buildQuizFilterResult(answers), [answers]);
  const hasAnySelections = hasQuizSelections(answers);
  const selectedValues = getSelectedValues(current, answers);
  const selectedCount = selectedValues.length;

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    cardRef.current?.scrollIntoView({ block: 'start' });
    questionRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  function trackStarted() {
    if (started.current) return;
    started.current = true;
    trackProductEvent({ event: 'quiz_started', page: 'quiz', source: 'quiz' });
  }

  function toggleOption(value: string) {
    trackStarted();
    const key = current.id;

    setAnswers((prev) => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value];

      return { ...prev, [key]: nextValues };
    });
  }

  function advanceStep() {
    trackStarted();
    if (isLastStep) {
      trackProductEvent({ event: 'quiz_completed', page: 'quiz', source: 'quiz' });
      setStepIndex(QUIZ_STEPS.length);
    } else {
      setStepIndex((index) => index + 1);
    }
  }

  function resetCurrentStep() {
    setAnswers((prev) => ({ ...prev, [current.id]: [] }));
  }

  function resetQuiz() {
    started.current = false;
    setStepIndex(0);
    setAnswers(createInitialQuizAnswers());
  }

  if (isComplete) {
    return (
      <div
        ref={cardRef}
        className="scroll-mt-28 rounded-[18px] border border-line bg-surface p-5 text-center sm:p-8"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tint text-ink">
          <CheckIcon />
        </div>
        <h2
          ref={questionRef}
          tabIndex={-1}
          className="mt-4 font-display text-3xl leading-none text-ink"
        >
          {hasAnySelections ? 'Bir sonraki kahven bu seçimlerde.' : 'Keşfe açık bir fincan.'}
        </h2>
        <p className="mt-2 text-muted">
          {hasAnySelections ? 'Aradığın tatlara ve demleme rutinine uyan kahveleri keşfet.' : 'Güncel kahveleri birlikte keşfedelim.'}
        </p>
        {result.explanations.length > 0 && (
          <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-line bg-tint p-4 text-left">
            <h3 className="text-sm font-semibold text-ink">
              Senin kahve profilin
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {result.explanations.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.explanations.length === 0 && (
          <p className="mx-auto mt-5 max-w-xl rounded-2xl border border-line bg-tint p-4 text-sm text-muted">
            Henüz bir tercihin yok. Katalogda tatları ve kavurucuları keşfederek başlayabilirsin.
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={result.url}
            className="button-dark button-lg"
          >
            Kahvelerimi keşfet
            <ArrowRightIcon />
          </Link>
          <button
            type="button"
            onClick={() => setStepIndex(QUIZ_STEPS.length - 1)}
            className="button-light button-lg"
          >
            Seçimlerimi düzenle
          </button>
          <button
            type="button"
            onClick={resetQuiz}
            className="button-light button-lg"
          >
            Tercihleri Yeniden Seç
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      className="scroll-mt-28 rounded-[18px] border border-line bg-surface p-5 sm:p-6"
    >
      <div className="mb-7">
        <div className="flex items-center justify-between gap-4 text-sm text-muted">
          <span>
            Soru {stepIndex + 1} / {QUIZ_STEPS.length}
          </span>
          <span>
            {selectedCount > 0 ? `${selectedCount} seçim` : 'Opsiyonel'}
          </span>
        </div>
        <div
          className="mt-3 flex gap-1"
          role="progressbar"
          aria-label="Quiz ilerlemesi"
          aria-valuemin={1}
          aria-valuemax={QUIZ_STEPS.length}
          aria-valuenow={stepIndex + 1}
          aria-valuetext={`${stepIndex + 1}. soru / ${QUIZ_STEPS.length}`}
        >
          {QUIZ_STEPS.map((stepItem, index) => (
            <div
              key={stepItem.id}
              className={`h-1.5 flex-1 rounded-full ${
                index <= stepIndex ? 'bg-accent' : 'bg-line'
              }`}
            />
          ))}
        </div>
      </div>

      <h2
        ref={questionRef}
        tabIndex={-1}
        className="rounded-md font-display text-[30px] leading-tight text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-4"
      >
        {current.question}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted">{current.helper}</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {current.options.map((opt) => {
          const isSelected = selectedValues.includes(opt.value);

          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => toggleOption(opt.value)}
              aria-pressed={isSelected}
              className={`flex min-h-[60px] items-start gap-3 rounded-[14px] px-4 py-3 text-left transition-colors ${
                isSelected
                  ? 'border-2 border-accent bg-chip text-ink'
                  : 'border border-line bg-surface text-ink hover:border-accent'
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-line bg-surface text-transparent'
                }`}
                aria-hidden="true"
              >
                <SmallCheckIcon />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[19px] leading-6">
                  {opt.label}
                </span>
                {opt.description && (
                  <span className="mt-1 block text-xs leading-5 text-muted">
                    {opt.description}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex min-h-8 items-center justify-between gap-3 text-sm">
        <div>
          <span className="text-muted">
            {selectedCount > 0
              ? `${selectedCount} seçim eklendi`
              : 'Bu adımı boş geçebilirsin'}
          </span>

        </div>
        {selectedCount > 0 && (
          <button
            type="button"
            onClick={resetCurrentStep}
            className="inline-flex min-h-11 items-center font-semibold text-accent underline-offset-4 hover:underline"
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
          className="button-light button-lg disabled:cursor-not-allowed disabled:border-line disabled:text-muted"
        >
          <ArrowLeftIcon />
          Geri
        </button>
        <div className="flex flex-wrap justify-end gap-2">
          {isLastStep && !hasAnySelections && (
            <Link
              href="/kahveler"
              className="button-light button-lg"
            >
              Tüm kataloğu aç
            </Link>
          )}
          <button
            type="button"
            onClick={advanceStep}
            className="button-dark button-lg"
          >
            {isLastStep ? 'Sonuçları Gör' : selectedCount > 0 ? 'İleri' : 'Bu adımı geç'}
            <ArrowRightIcon />
          </button>
        </div>
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12h14m-6-6 6 6-6 6"
      />
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 12H5m6 6-6-6 6-6"
      />
    </svg>
  );
}
