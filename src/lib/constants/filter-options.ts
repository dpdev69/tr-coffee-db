export const PROCESS_LABELS: Record<string, string> = {
  washed: 'Yıkanmış',
  natural: 'Natürel',
  honey: 'Honey',
  anaerobic: 'Anaerobik',
  semi_washed: 'Yarı Yıkanmış',
  wet_hulled: 'Islak Kabuk Soyma',
  experimental: 'Deneysel',
  unknown: 'Bilinmiyor',
};

export const PROCESS_VALUES = Object.keys(PROCESS_LABELS);

export const ROAST_LABELS: Record<string, string> = {
  light: 'Açık',
  medium_light: 'Orta-Açık',
  medium: 'Orta',
  medium_dark: 'Orta-Koyu',
  dark: 'Koyu',
  unknown: 'Bilinmiyor',
};

export const ROAST_VALUES = Object.keys(ROAST_LABELS);

export const FLAVOR_CATEGORIES = [
  'Fruity',
  'Floral',
  'Chocolate',
  'Sweet',
  'Nutty',
  'Spicy',
  'Roasted',
  'Herbal',
] as const;

export const FLAVOR_CATEGORY_LABELS: Record<(typeof FLAVOR_CATEGORIES)[number], string> = {
  Fruity: 'Meyvemsi',
  Floral: 'Çiçeksi',
  Chocolate: 'Çikolata',
  Sweet: 'Tatlı',
  Nutty: 'Kuruyemiş',
  Spicy: 'Baharatlı',
  Roasted: 'Kavrulmuş',
  Herbal: 'Bitkisel',
};

export const BREW_METHOD_LABELS: Record<string, string> = {
  espresso: 'Espresso',
  filter: 'Filtre / Pour Over',
  french_press: 'French Press',
  aeropress: 'Aeropress',
  turkish: 'Türk Kahvesi',
  cold_brew: 'Soğuk Demleme',
  moka_pot: 'Moka Pot',
};

export const BREW_METHOD_VALUES = Object.keys(BREW_METHOD_LABELS);

export const SORT_VALUES = [
  'newest',
  'price_asc',
  'price_desc',
  'unit_price_asc',
  'unit_price_desc',
  'popular',
] as const;

export const SORT_OPTIONS = [
  { value: 'newest', label: 'En Yeni' },
  { value: 'price_asc', label: 'Paket fiyatı: Artan' },
  { value: 'price_desc', label: 'Paket fiyatı: Azalan' },
  { value: 'unit_price_asc', label: '100 g fiyatı: Artan' },
  { value: 'unit_price_desc', label: '100 g fiyatı: Azalan' },
  { value: 'popular', label: 'En Popüler' },
] as const;

export type CoffeeSortOption = (typeof SORT_VALUES)[number];
