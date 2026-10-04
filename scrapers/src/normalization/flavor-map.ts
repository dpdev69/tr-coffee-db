import { foldTr, tokenRegex } from './text-match.js';

// Maps Turkish and English tasting note terms to standardized notes + SCA categories
// Format: [search terms] → { note: "English Name", category: "SCA Category" }

interface FlavorMapping {
  keywords: string[];
  note: string;
  category: string;
}

const FLAVOR_MAPPINGS: FlavorMapping[] = [
  // === FRUITY ===
  { keywords: ['çilek', 'strawberry'], note: 'Strawberry', category: 'Fruity' },
  { keywords: ['ahududu', 'raspberry', 'frambuaz'], note: 'Raspberry', category: 'Fruity' },
  { keywords: ['yaban mersini', 'blueberry', 'yabanmersini'], note: 'Blueberry', category: 'Fruity' },
  { keywords: ['böğürtlen', 'blackberry'], note: 'Blackberry', category: 'Fruity' },
  { keywords: ['kiraz', 'cherry', 'vişne'], note: 'Cherry', category: 'Fruity' },
  { keywords: ['şeftali', 'peach'], note: 'Peach', category: 'Fruity' },
  { keywords: ['kayısı', 'apricot'], note: 'Apricot', category: 'Fruity' },
  { keywords: ['erik', 'plum'], note: 'Plum', category: 'Fruity' },
  { keywords: ['elma', 'apple'], note: 'Apple', category: 'Fruity' },
  { keywords: ['armut', 'pear'], note: 'Pear', category: 'Fruity' },
  { keywords: ['üzüm', 'grape'], note: 'Grape', category: 'Fruity' },
  { keywords: ['mango'], note: 'Mango', category: 'Fruity' },
  { keywords: ['ananas', 'pineapple'], note: 'Pineapple', category: 'Fruity' },
  { keywords: ['portakal', 'orange'], note: 'Orange', category: 'Fruity' },
  { keywords: ['mandalina', 'tangerine', 'mandarin'], note: 'Tangerine', category: 'Fruity' },
  { keywords: ['limon', 'lemon'], note: 'Lemon', category: 'Fruity' },
  { keywords: ['greyfurt', 'grapefruit'], note: 'Grapefruit', category: 'Fruity' },
  { keywords: ['narenciye', 'citrus', 'turunçgil'], note: 'Citrus', category: 'Fruity' },
  { keywords: ['bergamot'], note: 'Bergamot', category: 'Fruity' },
  { keywords: ['kırmızı meyve', 'red fruit', 'red berry', 'kırmızı meyveler'], note: 'Red Fruits', category: 'Fruity' },
  { keywords: ['tropikal', 'tropical'], note: 'Tropical Fruit', category: 'Fruity' },
  { keywords: ['kurutulmuş meyve', 'dried fruit', 'kuru meyve'], note: 'Dried Fruit', category: 'Fruity' },
  { keywords: ['incir', 'fig'], note: 'Fig', category: 'Fruity' },
  { keywords: ['hurma', 'date'], note: 'Date', category: 'Fruity' },
  { keywords: ['meyvemsi', 'fruity'], note: 'Fruity', category: 'Fruity' },
  { keywords: ['passion fruit', 'çarkıfelek'], note: 'Passion Fruit', category: 'Fruity' },

  // === FLORAL ===
  { keywords: ['yasemin', 'jasmine'], note: 'Jasmine', category: 'Floral' },
  { keywords: ['gül', 'rose'], note: 'Rose', category: 'Floral' },
  { keywords: ['lavanta', 'lavender'], note: 'Lavender', category: 'Floral' },
  { keywords: ['çiçek', 'floral', 'çiçeksi'], note: 'Floral', category: 'Floral' },
  { keywords: ['portakal çiçeği', 'orange blossom'], note: 'Orange Blossom', category: 'Floral' },
  { keywords: ['papatya', 'chamomile'], note: 'Chamomile', category: 'Floral' },

  // === SWEET / CHOCOLATE ===
  { keywords: ['çikolata', 'chocolate', 'cikolata'], note: 'Chocolate', category: 'Chocolate' },
  { keywords: ['bitter çikolata', 'dark chocolate'], note: 'Dark Chocolate', category: 'Chocolate' },
  { keywords: ['sütlü çikolata', 'milk chocolate'], note: 'Milk Chocolate', category: 'Chocolate' },
  { keywords: ['kakao', 'cocoa', 'cacao'], note: 'Cocoa', category: 'Chocolate' },
  { keywords: ['karamel', 'caramel'], note: 'Caramel', category: 'Sweet' },
  { keywords: ['bal', 'honey'], note: 'Honey', category: 'Sweet' },
  { keywords: ['şeker', 'sugar', 'tatlı'], note: 'Sweet', category: 'Sweet' },
  { keywords: ['panela', 'brown sugar', 'esmer şeker'], note: 'Brown Sugar', category: 'Sweet' },
  { keywords: ['vanilya', 'vanilla'], note: 'Vanilla', category: 'Sweet' },
  { keywords: ['pekmez', 'molasses'], note: 'Molasses', category: 'Sweet' },
  { keywords: ['maple', 'akçaağaç'], note: 'Maple Syrup', category: 'Sweet' },

  // === NUTTY ===
  { keywords: ['fındık', 'hazelnut'], note: 'Hazelnut', category: 'Nutty' },
  { keywords: ['badem', 'almond'], note: 'Almond', category: 'Nutty' },
  { keywords: ['ceviz', 'walnut'], note: 'Walnut', category: 'Nutty' },
  { keywords: ['fıstık', 'peanut', 'yer fıstığı'], note: 'Peanut', category: 'Nutty' },
  { keywords: ['antep fıstığı', 'pistachio'], note: 'Pistachio', category: 'Nutty' },
  { keywords: ['kuruyemiş', 'nutty'], note: 'Nutty', category: 'Nutty' },

  // === SPICY ===
  { keywords: ['tarçın', 'cinnamon'], note: 'Cinnamon', category: 'Spicy' },
  { keywords: ['karanfil', 'clove'], note: 'Clove', category: 'Spicy' },
  { keywords: ['zencefil', 'ginger'], note: 'Ginger', category: 'Spicy' },
  { keywords: ['biber', 'pepper', 'karabiber'], note: 'Pepper', category: 'Spicy' },
  { keywords: ['baharatlı', 'spicy'], note: 'Spicy', category: 'Spicy' },
  { keywords: ['muskat', 'nutmeg'], note: 'Nutmeg', category: 'Spicy' },

  // === ROASTED / CEREAL ===
  { keywords: ['tost', 'toast'], note: 'Toast', category: 'Roasted' },
  { keywords: ['tahıl', 'cereal', 'grain'], note: 'Cereal', category: 'Roasted' },
  { keywords: ['bisküvi', 'biscuit', 'cookie'], note: 'Biscuit', category: 'Roasted' },
  { keywords: ['tereyağı', 'butter'], note: 'Butter', category: 'Roasted' },
  { keywords: ['krema', 'cream', 'creamy'], note: 'Cream', category: 'Roasted' },

  // === HERBAL / VEGETAL ===
  { keywords: ['çay', 'tea', 'siyah çay', 'black tea'], note: 'Black Tea', category: 'Herbal' },
  { keywords: ['yeşil çay', 'green tea'], note: 'Green Tea', category: 'Herbal' },
  { keywords: ['nane', 'mint'], note: 'Mint', category: 'Herbal' },
  { keywords: ['otsu', 'herbal'], note: 'Herbal', category: 'Herbal' },

  // === OTHER ===
  { keywords: ['tütün', 'tobacco'], note: 'Tobacco', category: 'Other' },
  { keywords: ['deri', 'leather'], note: 'Leather', category: 'Other' },
  { keywords: ['şarap', 'wine', 'winey'], note: 'Wine', category: 'Other' },
  { keywords: ['rom', 'rum'], note: 'Rum', category: 'Other' },
  { keywords: ['asidik', 'acidic', 'bright', 'parlak'], note: 'Bright Acidity', category: 'Other' },
];

// Everyday words that are also tasting notes. In a tasting section they are notes; in running prose "bal" is a
// process, "tatlı" is praise, "date" is "Roast Date" and "parlak" is "bright" for anything.
const PROSE_AMBIGUOUS = new Set(['bal', 'tatlı', 'date', 'parlak']);

/** `prose`: the text is a name, description or tags rather than a tasting section, so ambiguous words are skipped. */
export function matchFlavorNotes(text: string, strictWords = false, prose = false): {
  notes: string[];
  categories: string[];
} {
  const lower = text.toLowerCase();
  const folded = foldTr(text);
  const matchedNotes = new Set<string>();
  const matchedCategories = new Set<string>();

  for (const mapping of FLAVOR_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (prose && PROSE_AMBIGUOUS.has(keyword)) continue;
      if (strictWords ? tokenRegex(foldTr(keyword).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(folded) : lower.includes(keyword.toLowerCase())) {
        matchedNotes.add(mapping.note);
        matchedCategories.add(mapping.category);
        break;
      }
    }
  }

  return {
    notes: [...matchedNotes],
    categories: [...matchedCategories],
  };
}
