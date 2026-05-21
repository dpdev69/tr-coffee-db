import type { CoffeeConfidence, CoffeeConfidenceStatus } from '@/lib/coffee-confidence';

const SIGNAL_COPY: Record<Exclude<CoffeeConfidenceStatus, 'unavailable'>, string> = {
  verified: 'Son 72 saatte doğrulandı',
  recent: 'Bu hafta görüldü',
  partial: 'Bilgi kısmen eksik',
  stale: 'Güncelliği belirsiz',
};

const SIGNAL_CLASSES: Record<Exclude<CoffeeConfidenceStatus, 'unavailable'>, string> = {
  verified: 'text-emerald-700 before:bg-emerald-500',
  recent: 'text-sky-700 before:bg-sky-500',
  partial: 'text-amber-700 before:bg-amber-500',
  stale: 'text-stone-500 before:bg-stone-400',
};

export function CoffeeFreshnessSignal({ confidence }: { confidence: CoffeeConfidence }) {
  if (confidence.status === 'unavailable') return null;

  return (
    <p
      className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium leading-none ${SIGNAL_CLASSES[confidence.status]} before:block before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full`}
    >
      {SIGNAL_COPY[confidence.status]}
    </p>
  );
}
