import {
  BREW_METHOD_LABELS,
  BREW_METHOD_VALUES,
  FLAVOR_CATEGORIES,
  FLAVOR_CATEGORY_LABELS,
  PROCESS_LABELS,
  PROCESS_VALUES,
  ROAST_LABELS,
  ROAST_VALUES,
} from '@/lib/constants/filter-options';
import { QUIZ_DIMENSIONS, type QuizAnswers, type QuizDimension, type QuizReason } from '../../shared/v2/quiz-rank';

export type { QuizAnswers, QuizDimension };

export interface QuizOption {
  value: string;
  label: string;
  description?: string;
}

export interface QuizStep {
  id: QuizDimension;
  /** Short name for the progress line ("Adım 2 / 4 · Tat"). */
  short: string;
  question: string;
  helper: string;
  options: readonly QuizOption[];
}

const PROCESS_FILTER_VALUES = PROCESS_VALUES.filter((value) => value !== 'unknown');
const ROAST_FILTER_VALUES = ROAST_VALUES.filter((value) => value !== 'unknown');

const BREW_DESCRIPTIONS: Record<string, string> = {
  espresso: 'Espresso veya otomatik espresso makinesi için uygun çekirdekler.',
  filter: 'V60, Chemex ve benzeri filtre demlemeler için.',
  french_press: 'Gövdeyi öne çıkaran immersion demlemeler için.',
  aeropress: 'AeroPress tariflerinde belirtilen ya da uyumlu çekirdekler.',
  turkish: 'Cezve / Türk kahvesi kullanımına uygun seçenekler.',
  cold_brew: 'Soğuk demleme için önerilen kahveler.',
  moka_pot: 'Moka pot ile yoğun fincan arayanlar için.',
};

const FLAVOR_DESCRIPTIONS: Record<string, string> = {
  Fruity: 'Narenciye, kırmızı meyve, tropik ya da canlı meyve notları.',
  Floral: 'Yasemin, bergamot ve çiçeksi aromalar.',
  Chocolate: 'Kakao, çikolata ve bitter tatlar.',
  Sweet: 'Karamel, bal, şeker kamışı ve tatlı bitiş.',
  Nutty: 'Fındık, badem, ceviz ve yuvarlak gövde.',
  Spicy: 'Baharatlı, kompleks veya yoğun fincanlar.',
  Roasted: 'Kavrulmuş, klasik ve düşük asiditeli tatlar.',
  Herbal: 'Bitkisel, çay benzeri ya da ferah profiller.',
};

const PROCESS_DESCRIPTIONS: Record<string, string> = {
  washed: 'Meyve tabakaları kurutmadan önce uzaklaştırılır.',
  natural: 'Kahve meyvesi çekirdeğiyle birlikte kurutulur.',
  honey: 'Müsilajın bir kısmı kurutmada çekirdekte kalır; bal eklenmez.',
  anaerobic: 'Oksijenin sınırlandığı fermantasyon adımı içerir.',
  semi_washed: 'Kavurucunun yarı yıkanmış olarak belirttiği işlemler.',
  wet_hulled: 'Çekirdek henüz nemliyken parşömen kabuğu ayrılır.',
  experimental: 'Alışılmışın dışında işleme denemeleri.',
};

const ROAST_DESCRIPTIONS: Record<string, string> = {
  light: 'Asidite, aromatik netlik ve canlılık daha önde.',
  medium_light: 'Açık karakteri koruyan, biraz daha yuvarlak fincanlar.',
  medium: 'Denge, tatlılık ve orta gövde.',
  medium_dark: 'Daha belirgin gövde, daha düşük asidite.',
  dark: 'Yoğun, kavruk ve klasik koyu profil.',
};

export const QUIZ_STEPS: readonly QuizStep[] = [
  {
    id: 'brew',
    short: 'Demleme',
    question: 'Hangi demleme yöntemleri senin rutinin?',
    helper: 'Bir veya daha fazla yöntem seçebilirsin.',
    options: optionsFromLabels(BREW_METHOD_VALUES, BREW_METHOD_LABELS, BREW_DESCRIPTIONS),
  },
  {
    id: 'taste',
    short: 'Tat',
    question: 'Fincanda hangi tat ailesini arıyorsun?',
    helper: 'Bir veya daha fazla tat ailesi seçebilirsin.',
    options: optionsFromLabels(FLAVOR_CATEGORIES, FLAVOR_CATEGORY_LABELS, FLAVOR_DESCRIPTIONS),
  },
  {
    id: 'process',
    short: 'İşlem',
    question: 'İşleme tarafında bir tercihin var mı?',
    helper: 'Bilmiyorsan “Fark etmez” deyip devam edebilirsin.',
    options: optionsFromLabels(PROCESS_FILTER_VALUES, PROCESS_LABELS, PROCESS_DESCRIPTIONS),
  },
  {
    id: 'roast',
    short: 'Kavrum',
    question: 'Kavurma seviyesi nasıl olsun?',
    helper: 'Bir veya daha fazla kavrum aralığı seçebilirsin.',
    options: optionsFromLabels(ROAST_FILTER_VALUES, ROAST_LABELS, ROAST_DESCRIPTIONS),
  },
] as const;

/** "Fark etmez" is the empty selection: the step is left out of the ranking, exactly like skipping it. */
export const QUIZ_ANY = { label: 'Fark etmez', description: 'Bu adımı sıralamaya katma.' } as const;

export function createInitialQuizAnswers(): QuizAnswers {
  return { brew: [], taste: [], roast: [], process: [] };
}

export function hasQuizSelections(answers: QuizAnswers) {
  return QUIZ_DIMENSIONS.some((key) => answers[key].length > 0);
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;
/** Accepts `taste=Fruity,Floral` and repeated keys; keeps only known option ids, deduped, in option order. Anything else is dropped. */
export function parseQuizAnswers(source: ParamSource): QuizAnswers {
  const answers = createInitialQuizAnswers();
  for (const step of QUIZ_STEPS) {
    const input = source instanceof URLSearchParams ? source.getAll(step.id) : [source[step.id] ?? []].flat();
    const wanted = new Set(input.filter((value) => value.length <= 300).flatMap((value) => value.split(',')).map((value) => value.trim().toLowerCase()));
    answers[step.id] = step.options.map((option) => option.value).filter((value) => wanted.has(value.toLowerCase()));
  }
  return answers;
}

/** Option ids are fixed ASCII tokens, so they go into the URL unescaped and stay readable: `?brew=filter&taste=Fruity,Floral`. */
export function quizQuery(answers: QuizAnswers): string {
  return QUIZ_DIMENSIONS.filter((key) => answers[key].length).map((key) => `${key}=${answers[key].join(',')}`).join('&');
}
export function quizResultUrl(answers: QuizAnswers): string {
  const query = quizQuery(answers);
  return query ? `/quiz/sonuc?${query}` : '/quiz/sonuc';
}

const LABELS: Record<QuizDimension, Record<string, string>> = { brew: BREW_METHOD_LABELS, taste: FLAVOR_CATEGORY_LABELS, roast: ROAST_LABELS, process: PROCESS_LABELS };
const TASTE_WORDS: Record<string, string> = { Fruity: 'meyvemsi', Floral: 'çiçeksi', Chocolate: 'çikolatalı', Sweet: 'tatlı', Nutty: 'kuruyemişli', Spicy: 'baharatlı', Roasted: 'kavrulmuş', Herbal: 'bitkisel' };
const list = (values: string[]) => new Intl.ListFormat('tr', { type: 'conjunction' }).format(values);
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('tr') + text.slice(1);
const label = (dimension: QuizDimension, values: string[]) => list(values.map((value) => LABELS[dimension][value] ?? value));

/** Chip text for the answer summary on the result page. */
export function quizAnswerSummary(answers: QuizAnswers): string[] {
  return QUIZ_STEPS.map(({ id, short }) => {
    const values = answers[id];
    if (!values.length) return `${short}: fark etmez`;
    if (id === 'taste') return capitalize(list(values.map((value) => TASTE_WORDS[value] ?? value)));
    if (id === 'roast') return `${label(id, values)} kavrum`;
    if (id === 'process') return `${label(id, values)} işlem`;
    return label(id, values);
  });
}

const SOURCE_TEXT = { manual: 'doğrulanmış düzeltme', stated: 'kavurucu belirtiyor', labelled: 'kavurucu belirtiyor', inferred: 'açıklamadan çıkarıldı' } as const;
const MISSING_TEXT: Record<QuizDimension, string> = { brew: 'Demleme önerisi yok', taste: 'Tat bilgisi yok', roast: 'Kavrum bilgisi yok', process: 'İşlem bilgisi yok' };
/** One line per reason, always saying where the fact came from. Never a number. */
export function formatQuizReason(reason: QuizReason): { dimension: QuizDimension; kind: QuizReason['kind']; text: string; source: string | null } {
  const { dimension, kind, values } = reason;
  const source = reason.provenance ? SOURCE_TEXT[reason.provenance] : null;
  if (kind === 'missing') return { dimension, kind, text: MISSING_TEXT[dimension], source };
  const fact = dimension === 'taste' ? `${capitalize(list(values.map((value) => TASTE_WORDS[value] ?? value)))} notalar`
    : dimension === 'brew' ? `${label(dimension, values)} için uygun`
      : dimension === 'roast' ? `${label(dimension, values)} kavrum` : `${label(dimension, values)} işlem`;
  const suffix = kind === 'near' ? ', seçimine yakın' : kind === 'conflict' ? ', seçiminden farklı' : '';
  return { dimension, kind, text: fact + suffix, source };
}

/** For /api/quiz/match. `limit`: whole number, 1–12, default 4. Anything else falls back to the default rather than failing a widget. */
export function parseMatchLimit(value: string | null): number {
  if (!value || !/^\d{1,3}$/.test(value)) return 4;
  return Math.min(12, Math.max(1, Number(value)));
}

/** The taste profile lives only on this device. Storage can be blocked or full; the quiz works without it. */
export const TASTE_STORAGE_KEY = 'kahvedrop:taste';
export function saveTasteProfile(answers: QuizAnswers, storage?: Storage) {
  try {
    const { brew, taste, roast, process } = answers;
    (storage ?? window.localStorage).setItem(TASTE_STORAGE_KEY, JSON.stringify({ brew, taste, roast, process, savedAt: new Date().toISOString() }));
  } catch { /* Private mode, quota or disabled storage: nothing to remember, nothing breaks. */ }
}
export function loadTasteProfile(storage?: Storage): QuizAnswers | null {
  try {
    const saved: unknown = JSON.parse((storage ?? window.localStorage).getItem(TASTE_STORAGE_KEY) ?? 'null');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
    const record = saved as Record<string, unknown>;
    return parseQuizAnswers(Object.fromEntries(QUIZ_DIMENSIONS.map((key) => [key, Array.isArray(record[key]) ? record[key].filter((value): value is string => typeof value === 'string') : []])));
  } catch { return null; }
}

function optionsFromLabels(
  values: readonly string[],
  labels: Record<string, string>,
  descriptions: Record<string, string>
): QuizOption[] {
  return values.map((value) => ({
    value,
    label: labels[value] ?? value,
    description: descriptions[value],
  }));
}
