export const PROCESS_LABELS: Record<string, string> = {
  washed: 'Yıkanmış',
  natural: 'Natürel',
  honey: 'Honey',
  anaerobic: 'Anaerobik',
  semi_washed: 'Yarı Yıkanmış',
  wet_hulled: 'Islak Kabuk Soyma',
  experimental: 'Deneysel',
};

export const ROAST_LABELS: Record<string, string> = {
  light: 'Açık',
  medium_light: 'Orta-Açık',
  medium: 'Orta',
  medium_dark: 'Orta-Koyu',
  dark: 'Koyu',
};

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
  filter: 'Filter / Pour Over',
  french_press: 'French Press',
  aeropress: 'Aeropress',
  turkish: 'Türk Kahvesi',
  cold_brew: 'Soğuk Demleme',
  moka_pot: 'Moka Pot',
};

export const SORT_OPTIONS = [
  { value: 'newest', label: 'En Yeni' },
  { value: 'price_asc', label: 'Fiyat: Artan' },
  { value: 'price_desc', label: 'Fiyat: Azalan' },
  { value: 'popular', label: 'En Popüler' },
] as const;
