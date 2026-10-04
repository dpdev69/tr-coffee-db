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
import type { CoffeeFilters } from '@/lib/queries/coffees';

export type QuizArrayAnswerKey = 'brewMethod' | 'flavorCategory' | 'process' | 'roastLevel';

export interface QuizAnswers {
  brewMethod: string[];
  flavorCategory: string[];
  process: string[];
  roastLevel: string[];
}

export interface QuizFilterResult {
  url: string;
  explanations: string[];
  filters: CoffeeFilters;
}

export interface QuizOption {
  value: string;
  label: string;
  description?: string;
}

interface QuizStepBase {
  question: string;
  helper: string;
  catalogField: string;
  queryParam: string;
  options: readonly QuizOption[];
}

export type QuizStep =
  QuizStepBase & {
    id: QuizArrayAnswerKey;
    selection: 'multiple';
  };

interface ArrayFilterSpec {
  key: QuizArrayAnswerKey;
  explanationLabel: string;
  queryParam: string;
  labels: Record<string, string>;
  allowedValues: ReadonlySet<string>;
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
    id: 'brewMethod',
    selection: 'multiple',
    question: 'Hangi demleme yöntemleri senin rutinin?',
    helper: 'Bir veya daha fazla yöntem seçebilirsin.',
    catalogField: 'coffees.brew_methods',
    queryParam: 'brewMethod',
    options: optionsFromLabels(BREW_METHOD_VALUES, BREW_METHOD_LABELS, BREW_DESCRIPTIONS),
  },
  {
    id: 'flavorCategory',
    selection: 'multiple',
    question: 'Fincanda hangi tat ailesini arıyorsun?',
    helper: 'Bir veya daha fazla tat ailesi seçebilirsin.',
    catalogField: 'coffees.flavor_categories',
    queryParam: 'taste',
    options: optionsFromLabels(
      FLAVOR_CATEGORIES,
      FLAVOR_CATEGORY_LABELS,
      FLAVOR_DESCRIPTIONS
    ),
  },
  {
    id: 'process',
    selection: 'multiple',
    question: 'İşleme tarafında bir tercihin var mı?',
    helper: 'Bilmiyorsan boş bırakıp devam edebilirsin.',
    catalogField: 'coffees.process',
    queryParam: 'process',
    options: optionsFromLabels(PROCESS_FILTER_VALUES, PROCESS_LABELS, PROCESS_DESCRIPTIONS),
  },
  {
    id: 'roastLevel',
    selection: 'multiple',
    question: 'Kavurma seviyesi nasıl olsun?',
    helper: 'Bir veya daha fazla kavrum aralığı seçebilirsin.',
    catalogField: 'coffees.roast_level',
    queryParam: 'roast',
    options: optionsFromLabels(ROAST_FILTER_VALUES, ROAST_LABELS, ROAST_DESCRIPTIONS),
  },
] as const;

const ARRAY_FILTER_SPECS: readonly ArrayFilterSpec[] = [
  {
    key: 'brewMethod',
    queryParam: 'brewMethod',
    explanationLabel: 'Demleme uyumu',
    labels: BREW_METHOD_LABELS,
    allowedValues: new Set(BREW_METHOD_VALUES),
  },
  {
    key: 'flavorCategory',
    queryParam: 'taste',
    explanationLabel: 'Tat kategorisi',
    labels: FLAVOR_CATEGORY_LABELS,
    allowedValues: new Set<string>(FLAVOR_CATEGORIES),
  },
  {
    key: 'process',
    queryParam: 'process',
    explanationLabel: 'İşleme',
    labels: PROCESS_LABELS,
    allowedValues: new Set(PROCESS_FILTER_VALUES),
  },
  {
    key: 'roastLevel',
    queryParam: 'roast',
    explanationLabel: 'Kavurma seviyesi',
    labels: ROAST_LABELS,
    allowedValues: new Set(ROAST_FILTER_VALUES),
  },
] as const;

export function createInitialQuizAnswers(): QuizAnswers {
  return {
    brewMethod: [],
    flavorCategory: [],
    process: [],
    roastLevel: [],
  };
}

export function buildQuizFilterResult(answers: QuizAnswers): QuizFilterResult {
  const params = new URLSearchParams();
  const explanations: string[] = [];
  const filters: CoffeeFilters = {};

  for (const spec of ARRAY_FILTER_SPECS) {
    const values = getUniqueAllowedValues(answers[spec.key], spec.allowedValues);
    if (values.length === 0) continue;

    filters[spec.key] = values;
    values.forEach((value) => params.append(spec.queryParam, value));
    explanations.push(
      `${spec.explanationLabel}: ${values
        .map((value) => spec.labels[value] ?? value)
        .join(', ')}.`
    );
  }

  const query = params.toString();

  return {
    url: query ? `/kahveler?${query}` : '/kahveler',
    explanations,
    filters,
  };
}

export function hasQuizSelections(answers: Partial<QuizAnswers | CoffeeFilters>) {
  return ARRAY_FILTER_SPECS.some((spec) => {
    const value = answers[spec.key];
    return Array.isArray(value) && value.length > 0;
  });
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

function getUniqueAllowedValues(values: string[], allowedValues: ReadonlySet<string>) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (!allowedValues.has(value) || seen.has(value)) continue;
    seen.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
}
