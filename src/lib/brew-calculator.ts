export const BREW_STARTERS = {
  filter: {
    name: 'Filtre / V60',
    dose: 15,
    ratio: 17,
    output: 'Demleme suyu',
    sourceName: 'Counter Culture · Pour-over rehberi',
    source:
      'https://counterculturecoffee.com/blogs/counter-culture-coffee/guide-to-pour-over-coffee',
    note: '1:17, kuru kahve ile eklediğin su arasındaki oran. Bir başlangıç noktasıdır; damak tadına göre ayarla.',
    steps: [
      'Filtreyi sıcak suyla durula; durulama suyunu dök.',
      'Kahveyi demlemeden hemen önce öğüt. Suyu dengeli ve kontrollü dök.',
      'Sonucu tadıp bir sonraki demlemede tek bir değişkeni ayarla.',
    ],
  },
  espresso: {
    name: 'Espresso',
    dose: 18,
    ratio: 2,
    output: 'Fincandaki espresso',
    sourceName: 'Counter Culture · Espresso tarifi',
    source: 'https://counterculturecoffee.com/pages/quick-easy-espresso',
    note: '1:2, kuru kahve ile fincandaki içecek arasındaki oran; makineye koyacağın su miktarı değildir. Sepetinin kapasitesine uygun doz kullan.',
    steps: [
      '1:2 içecek oranıyla başla; başlangıç için 25–35 saniye hedefle.',
      'Dozu ve çıktıyı sabit tutarak öğütümü ayarla.',
      'Bu bir başlangıç tarifi. Kavurucunun çekirdeğe özel önerisini de dene.',
    ],
  },
  french_press: {
    name: 'French press',
    dose: 30,
    ratio: 850 / 56,
    output: 'Demleme suyu',
    sourceName: 'Stumptown · French press rehberi',
    source: 'https://www.stumptowncoffee.com/pages/brew-guide-french-press',
    note: 'Kaynağın 56 g kahve / 850 g su tarifi seçtiğin doza ölçeklenir. Kabının hacmine uygun doz seç.',
    steps: [
      'Kalın öğütüm ve yaklaşık 96°C suyla başla.',
      'Dördüncü dakikada pistonu yavaşça indir.',
      'Demlenmeyi durdurmak için kahveyi başka bir kaba aktar.',
    ],
  },
  aeropress: {
    name: 'AeroPress',
    dose: 17,
    ratio: 220 / 17,
    output: 'Demleme suyu',
    sourceName: 'Stumptown · AeroPress rehberi',
    source: 'https://www.stumptowncoffee.com/pages/brew-guide-aeropress',
    note: 'Kaynağın 17 g kahve / 220 g su tarifi seçtiğin doza ölçeklenir. Miktarı cihazının kapasitesiyle sınırla.',
    steps: [
      'Sofra tuzuna benzer ince öğütüm ve yaklaşık 96°C suyla başla.',
      '1:15’te karıştır, ardından yavaşça bastır.',
      'Yaklaşık 2 dakikada tamamla. Direnç fazlaysa zorlamadan öğütümü kontrol et.',
    ],
  },
} as const;
export type BrewMethod = keyof typeof BREW_STARTERS;
export function calculateBrewAmount(
  dose: number,
  method: BrewMethod,
): number | null {
  if (!Number.isFinite(dose) || dose <= 0 || dose > 100) return null;
  return Math.round(dose * BREW_STARTERS[method].ratio);
}
