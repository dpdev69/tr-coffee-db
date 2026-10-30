import { absoluteUrl } from './site';
import { sideKey, type ComparisonData, type Share, type SideFacts, type SideRef } from './comparisons';

/**
 * Written guides under /rehber. Their copy is fixed (dated in content-dates.ts); the few numbers they show come from the
 * comparison facts that /karsilastir already derives once per refresh (2 rows a read), and the coffee cards from the
 * espresso-vs-filtre pair's derived cards. They add no catalog query of their own.
 */
export const BREW_GUIDE_PATH = '/rehber/filtre-kahve-nasil-yapilir';
export const BEAN_GUIDE_PATH = '/rehber/filtre-kahve-cekirdegi';
export const GUIDE_PATHS = [BREW_GUIDE_PATH, BEAN_GUIDE_PATH] as const;
/** The pair whose derived cards hold the coffees roasters recommend for filter. */
export const FILTER_PAIR = 'espresso-vs-filtre';
export const FILTER_SIDE: SideRef = { kind: 'brew', value: 'filter' };
/** Below this many coffees stating a fact, a share is not printed: it would not say anything. */
export const MIN_STATED = 10;

export interface Faq { question: string; answer: string }

/** FAQPage from the questions and answers the page shows, word for word. */
export function faqPage(items: readonly Faq[]) {
  return { '@type': 'FAQPage', mainEntity: items.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) };
}

export interface HowToStep { name: string; text: string }
/** HowTo for one recipe the page shows step by step; anchors point at the visible steps. */
export function howTo(name: string, description: string, path: string, steps: readonly HowToStep[], { supply, tool, totalTime }: { supply: string[]; tool: string[]; totalTime: string }) {
  return { '@type': 'HowTo', name, description, inLanguage: 'tr-TR', totalTime,
    supply: supply.map(item => ({ '@type': 'HowToSupply', name: item })), tool: tool.map(item => ({ '@type': 'HowToTool', name: item })),
    step: steps.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, name: step.name, text: step.text, url: absoluteUrl(`${path}#adim-${index + 1}`) })) };
}

const ISTANBUL = 'Europe/Istanbul';
export const trDay = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ISTANBUL });
export const lira = (value: number) => `${Math.round(value).toLocaleString('tr-TR')} TL`;

/** One side of the derived comparison facts, or null when the facts (or a last-good copy written before the side existed) lack it. */
export function sideFacts(data: ComparisonData | null, side: SideRef): SideFacts | null {
  return data?.sides[sideKey(side)] ?? null;
}

/** "Meyvemsi 66, Çiçeksi 32 ve Tatlı 25": the leading values, only when enough coffees state the fact. */
export function leading(items: Share[], stated: number, limit = 3): string | null {
  if (stated < MIN_STATED || !items.length) return null;
  return new Intl.ListFormat('tr', { type: 'conjunction' }).format(items.slice(0, limit).map(item => `${item.label} ${item.count}`));
}

/** How many of the coffees that state a taste carry this family, or null when too few state one. */
export function tasteCount(facts: SideFacts, key: string): number | null {
  if (facts.stated.taste < MIN_STATED) return null;
  return facts.tastes.find(item => item.key === key)?.count ?? 0;
}
