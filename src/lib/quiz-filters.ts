export interface QuizAnswers {
  brew: string | null;
  flavors: string[];
  adventure: string | null;
  roast: string | null;
  budget: string | null;
}

export interface QuizFilterResult {
  url: string;
  explanations: string[];
}

const BREW_EXPLANATIONS: Record<string, string> = {
  espresso: 'Demleme: Espresso filtresi eklendi.',
  filter: 'Demleme: Filter / V60 filtresi eklendi.',
  french_press: 'Demleme: French Press filtresi eklendi.',
  aeropress: 'Demleme: Aeropress filtresi eklendi.',
  turkish: 'Demleme: Türk kahvesi filtresi eklendi.',
};

const FLAVOR_EXPLANATIONS: Record<string, string> = {
  Fruity: 'Tat: Meyvemsi kahveler öne alındı.',
  Chocolate: 'Tat: Çikolata notları öne alındı.',
  Nutty: 'Tat: Kuruyemiş notları öne alındı.',
  Floral: 'Tat: Çiçeksi notlar öne alındı.',
  Sweet: 'Tat: Tatlı/karamelimsi notlar öne alındı.',
  Spicy: 'Tat: Baharatlı notlar öne alındı.',
};

const ROAST_EXPLANATIONS: Record<string, string> = {
  light: 'Kavrum: Açık kavrum filtresi eklendi.',
  medium: 'Kavrum: Orta kavrum filtresi eklendi.',
  dark: 'Kavrum: Koyu kavrum filtresi eklendi.',
};

export function buildQuizFilterResult(answers: QuizAnswers): QuizFilterResult {
  const params = new URLSearchParams();
  const explanations: string[] = [];

  if (answers.brew && answers.brew !== 'any') {
    params.append('brewMethod', answers.brew);
    explanations.push(BREW_EXPLANATIONS[answers.brew] ?? `Demleme: ${answers.brew}`);
  }

  for (const flavor of answers.flavors) {
    params.append('flavorCategory', flavor);
    explanations.push(FLAVOR_EXPLANATIONS[flavor] ?? `Tat: ${flavor}`);
  }

  if (answers.roast && answers.roast !== 'any') {
    params.append('roastLevel', answers.roast);
    explanations.push(ROAST_EXPLANATIONS[answers.roast] ?? `Kavrum: ${answers.roast}`);
  }

  if (answers.budget === 'low') {
    params.set('priceMax', '120');
    explanations.push('Bütçe: 250 g için 300 TL altı, en fazla 120 TL/100 g olarak çevrildi.');
  } else if (answers.budget === 'mid') {
    params.set('priceMin', '120');
    params.set('priceMax', '200');
    explanations.push('Bütçe: 250 g için 300-500 TL, 120-200 TL/100 g aralığına çevrildi.');
  } else if (answers.budget === 'high') {
    params.set('priceMin', '200');
    explanations.push('Bütçe: 250 g için 500 TL üzeri, 200 TL/100 g ve üzeri olarak çevrildi.');
  } else if (answers.budget === 'any') {
    explanations.push('Bütçe: fiyat sınırı eklenmedi.');
  }

  if (answers.adventure === 'surprise') {
    params.set('sort', 'newest');
    explanations.push('Keşif modu: daha yeni eklenen kahveler önce gösterilecek.');
  } else if (answers.adventure === 'classic') {
    params.set('sort', 'popular');
    explanations.push('Keşif modu: daha çok ilgi gören kahveler önce gösterilecek.');
  }

  const query = params.toString();

  return {
    url: query ? `/coffees?${query}` : '/coffees',
    explanations,
  };
}
