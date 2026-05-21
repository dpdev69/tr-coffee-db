import {
  BREW_METHOD_LABELS,
  FLAVOR_CATEGORY_LABELS,
  PROCESS_LABELS,
  ROAST_LABELS,
} from '@/lib/constants/filter-options';
import type { Coffee } from '@/lib/types/database';

type SearchableCoffee = Pick<
  Coffee,
  | 'name'
  | 'name_normalized'
  | 'origin_country'
  | 'origin_region'
  | 'origin_farm'
  | 'origin_producer'
  | 'process'
  | 'process_detail'
  | 'roast_level'
  | 'variety'
  | 'flavor_notes'
  | 'flavor_notes_normalized'
  | 'flavor_categories'
  | 'brew_methods'
> & {
  roasters?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

const COMBINING_MARKS = /[\u0300-\u036f]/g;

const BREW_METHOD_ALIASES: Record<string, string[]> = {
  espresso: ['espresso', 'shot', 'flat white', 'latte', 'cappuccino'],
  filter: ['filter', 'filtre', 'pour over', 'pourover', 'v60', 'chemex', 'origami', 'dripper'],
  french_press: ['french press', 'cafetiere'],
  aeropress: ['aeropress'],
  turkish: ['turk kahvesi', 'turkish coffee', 'cezve', 'ibrik'],
  cold_brew: ['cold brew', 'soguk demleme'],
  moka_pot: ['moka pot', 'moka'],
};

const FLAVOR_ALIASES: Record<string, string[]> = {
  Fruity: ['meyvemsi', 'meyve', 'canli', 'narenciye', 'berry', 'kirmizi meyve'],
  Floral: ['ciceksi', 'floral', 'yasemin', 'lavanta'],
  Chocolate: ['cikolata', 'kakao', 'chocolate'],
  Sweet: ['tatli', 'karamel', 'bal', 'sweet'],
  Nutty: ['kuruyemis', 'findik', 'badem', 'nutty'],
  Spicy: ['baharat', 'spicy'],
  Roasted: ['kavrulmus', 'klasik', 'tanidik'],
  Herbal: ['bitkisel', 'herbal'],
};

export function coffeeMatchesSearch(coffee: SearchableCoffee, query: string) {
  const tokens = tokenizeSearch(query);
  if (tokens.length === 0) return true;

  const text = buildCoffeeSearchText(coffee);
  return tokens.every((token) => text.includes(token));
}

export function buildCoffeeSearchText(coffee: SearchableCoffee) {
  const parts: string[] = [
    coffee.name,
    coffee.name_normalized,
    Array.isArray(coffee.roasters) ? coffee.roasters[0]?.name : coffee.roasters?.name,
    coffee.origin_country,
    coffee.origin_region,
    coffee.origin_farm,
    coffee.origin_producer,
    coffee.process,
    coffee.process_detail,
    PROCESS_LABELS[coffee.process],
    coffee.roast_level,
    ROAST_LABELS[coffee.roast_level],
    coffee.variety,
    ...coffee.flavor_notes,
    ...coffee.flavor_notes_normalized,
  ].filter((item): item is string => Boolean(item));

  for (const method of coffee.brew_methods) {
    parts.push(method, BREW_METHOD_LABELS[method] ?? '', ...(BREW_METHOD_ALIASES[method] ?? []));
  }

  for (const category of coffee.flavor_categories) {
    const typedCategory = category as keyof typeof FLAVOR_CATEGORY_LABELS;
    parts.push(category, FLAVOR_CATEGORY_LABELS[typedCategory] ?? '', ...(FLAVOR_ALIASES[category] ?? []));
  }

  return normalizeSearchText(parts.join(' '));
}

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .toLowerCase()
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[şŞ]/g, 's')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearch(query: string) {
  return normalizeSearchText(query).split(' ').filter(Boolean);
}
