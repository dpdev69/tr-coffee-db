export const PROCESS_LABELS: Record<string, string> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
  semi_washed: 'Semi-Washed',
  wet_hulled: 'Wet Hulled',
  experimental: 'Experimental',
};

export const ROAST_LABELS: Record<string, string> = {
  light: 'Light',
  medium_light: 'Medium-Light',
  medium: 'Medium',
  medium_dark: 'Medium-Dark',
  dark: 'Dark',
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

export const BREW_METHOD_LABELS: Record<string, string> = {
  espresso: 'Espresso',
  filter: 'Filter / Pour Over',
  french_press: 'French Press',
  aeropress: 'Aeropress',
  turkish: 'Turkish',
  cold_brew: 'Cold Brew',
  moka_pot: 'Moka Pot',
};

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
] as const;
