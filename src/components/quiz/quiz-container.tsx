'use client';

import { useState } from 'react';
import Link from 'next/link';

interface QuizState {
  brew: string | null;
  flavors: string[];
  adventure: string | null;
  roast: string | null;
  budget: string | null;
}

const STEPS = [
  {
    id: 'brew',
    question: 'Kahveni genelde nasıl demliyorsun?',
    options: [
      { value: 'espresso', label: 'Espresso' },
      { value: 'filter', label: 'Pour Over / V60' },
      { value: 'french_press', label: 'French Press' },
      { value: 'aeropress', label: 'Aeropress' },
      { value: 'turkish', label: 'Türk Kahvesi (Cezve)' },
    ],
    multi: false,
  },
  {
    id: 'flavors',
    question: 'Hangi tatları seviyorsun?',
    subtitle: 'İstediğin kadar seçebilirsin',
    options: [
      { value: 'Fruity', label: 'Meyvemsi ve Canlı' },
      { value: 'Chocolate', label: 'Çikolatalı' },
      { value: 'Nutty', label: 'Kuruyemişsi ve Yumuşak' },
      { value: 'Floral', label: 'Çiçeksi' },
      { value: 'Sweet', label: 'Karamelimsi ve Tatlı' },
      { value: 'Spicy', label: 'Baharatlı ve Yoğun' },
    ],
    multi: true,
  },
  {
    id: 'adventure',
    question: 'Ne kadar yeni tatlar denemek istiyorsun?',
    options: [
      { value: 'classic', label: 'Klasik ve Tanıdık' },
      { value: 'surprise', label: 'Beni Şaşırt!' },
    ],
    multi: false,
  },
  {
    id: 'roast',
    question: 'Kavurma tercihin ne?',
    options: [
      { value: 'light', label: 'Açık' },
      { value: 'medium', label: 'Orta' },
      { value: 'dark', label: 'Koyu' },
      { value: 'any', label: 'Fark etmez' },
    ],
    multi: false,
  },
  {
    id: 'budget',
    question: '250 g için bütçen ne kadar?',
    options: [
      { value: 'low', label: '300 TL altı' },
      { value: 'mid', label: '300 - 500 TL' },
      { value: 'high', label: '500 TL ve üzeri' },
      { value: 'any', label: 'Sınır yok' },
    ],
    multi: false,
  },
];

export function QuizContainer() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizState>({
    brew: null,
    flavors: [],
    adventure: null,
    roast: null,
    budget: null,
  });

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const isComplete = step >= STEPS.length;

  function selectOption(value: string) {
    const id = current.id as keyof QuizState;

    if (current.multi) {
      setAnswers((prev) => {
        const arr = prev[id] as string[];
        const next = arr.includes(value)
          ? arr.filter((v) => v !== value)
          : [...arr, value];
        return { ...prev, [id]: next };
      });
    } else {
      setAnswers((prev) => ({ ...prev, [id]: value }));
      // Auto-advance for single-select
      setTimeout(() => {
        if (isLastStep) {
          setStep(STEPS.length);
        } else {
          setStep((s) => s + 1);
        }
      }, 200);
    }
  }

  function handleNext() {
    if (isLastStep) {
      setStep(STEPS.length);
    } else {
      setStep((s) => s + 1);
    }
  }

  // Build filter URL from quiz answers
  function buildFilterUrl(): string {
    const params = new URLSearchParams();

    if (answers.brew && answers.brew !== 'any') {
      params.append('brewMethod', answers.brew);
    }
    for (const f of answers.flavors) {
      params.append('flavorCategory', f);
    }
    if (answers.roast && answers.roast !== 'any') {
      params.append('roastLevel', answers.roast);
    }
    if (answers.budget === 'low') {
      params.set('priceMax', '120'); // ~300 TL for 250g = 120/100g
    } else if (answers.budget === 'mid') {
      params.set('priceMin', '120');
      params.set('priceMax', '200');
    } else if (answers.budget === 'high') {
      params.set('priceMin', '200');
    }

    if (answers.adventure === 'surprise') {
      params.set('sort', 'newest');
    } else {
      params.set('sort', 'popular');
    }

    return `/coffees?${params.toString()}`;
  }

  if (isComplete) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl">
          &#10003;
        </div>
        <h2 className="mt-4 text-xl font-bold text-stone-900">
          Sana uygun kahveleri bulduk!
        </h2>
        <p className="mt-2 text-stone-500">
          Tercihlerine göre önerilerimiz hazır.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={buildFilterUrl()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Eşleşmelerimi Gör
          </Link>
          <button
            onClick={() => {
              setStep(0);
              setAnswers({ brew: null, flavors: [], adventure: null, roast: null, budget: null });
            }}
            className="inline-flex items-center justify-center rounded-lg border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Testi Yeniden Çöz
          </button>
        </div>
      </div>
    );
  }

  const selectedValue = current.multi
    ? (answers[current.id as keyof QuizState] as string[])
    : answers[current.id as keyof QuizState];

  return (
    <div>
      {/* Progress */}
      <div className="mb-8 flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? 'bg-amber-500' : 'bg-stone-200'
            }`}
          />
        ))}
      </div>

      <h2 className="text-xl font-bold text-stone-900">{current.question}</h2>
      {current.subtitle && (
        <p className="mt-1 text-sm text-stone-500">{current.subtitle}</p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {current.options.map((opt) => {
          const isSelected = current.multi
            ? (selectedValue as string[]).includes(opt.value)
            : selectedValue === opt.value;

          return (
            <button
              key={opt.value}
              onClick={() => selectOption(opt.value)}
              className={`rounded-xl border-2 px-5 py-4 text-left text-sm font-medium transition-colors ${
                isSelected
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-40"
        >
          Geri
        </button>
        {current.multi && (
          <button
            onClick={handleNext}
            disabled={current.multi && (selectedValue as string[]).length === 0}
            className="rounded-lg bg-amber-600 px-6 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
          >
            {isLastStep ? 'Sonuçları Gör' : 'İleri'}
          </button>
        )}
      </div>
    </div>
  );
}
