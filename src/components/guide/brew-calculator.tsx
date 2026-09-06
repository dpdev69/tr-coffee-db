'use client';
import { useState } from 'react';
import {
  BREW_STARTERS,
  calculateBrewAmount,
  type BrewMethod,
} from '@/lib/brew-calculator';

export function BrewCalculator() {
  const [method, setMethod] = useState<BrewMethod>('filter');
  const [dose, setDose] = useState('15');
  const recipe = BREW_STARTERS[method];
  const amount = calculateBrewAmount(dose.trim() ? Number(dose) : NaN, method);
  return (
    <section
      className="calculator"
      id="calculator"
      aria-labelledby="calculator-title"
    >
      <p className="eyebrow">Ölç, demle, tadına bak</p>
      <h2 id="calculator-title">Fincanını hesapla.</h2>
      <p className="mt-3">
        Kahve miktarını gir; seçtiğin yöntem için başlangıç oranını bul.
      </p>
      <label htmlFor="brew-method">Nasıl demliyorsun?</label>
      <select
        id="brew-method"
        value={method}
        onChange={(event) => {
          const next = event.target.value as BrewMethod;
          setMethod(next);
          setDose(String(BREW_STARTERS[next].dose));
        }}
      >
        {Object.entries(BREW_STARTERS).map(([value, recipe]) => (
          <option key={value} value={value}>
            {recipe.name}
          </option>
        ))}
      </select>
      <label htmlFor="brew-dose">Kahve miktarı (g)</label>
      <input
        id="brew-dose"
        type="number"
        inputMode="decimal"
        min="1"
        max="100"
        step="any"
        value={dose}
        aria-invalid={amount === null}
        aria-describedby={amount === null ? 'dose-error' : 'brew-note'}
        onChange={(event) => setDose(event.target.value)}
      />
      {amount === null ? (
        <p id="dose-error" role="alert" className="mt-3">
          0’dan büyük, en fazla 100 g bir miktar gir.
        </p>
      ) : (
        <div
          className="calculator-result"
          aria-live="polite"
          aria-atomic="true"
        >
          <span>{recipe.output}</span>
          <strong>{amount.toLocaleString('tr-TR')} g</strong>
          <span>
            {dose} g kahve · 1:
            {recipe.ratio.toLocaleString('tr-TR', {
              maximumFractionDigits: 2,
            })}{' '}
            oran
          </span>
        </div>
      )}
      <p id="brew-note">{recipe.note}</p>
      <ol>
        {recipe.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="border-t border-[#bbc6ad] pt-4">
        Kaynak:{' '}
        <a href={recipe.source} target="_blank" rel="noopener noreferrer">
          {recipe.sourceName} ↗
        </a>
      </p>
    </section>
  );
}
