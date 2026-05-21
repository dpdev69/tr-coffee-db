import type { RoasterConfig } from '../types.js';

// ==========================================
// SHOPIFY ROASTERS (8) — all prices in TL
// ==========================================

export const petra: RoasterConfig = {
  slug: 'petra',
  name: 'Petra Coffee',
  websiteUrl: 'https://petracoffee.com',
  shopUrl: 'https://petracoffee.com',
  platform: 'shopify',
  city: 'Istanbul',
  priceFormat: 'tl',
  productTypeFilter: ['kahve', 'coffee'],
};

export const montag: RoasterConfig = {
  slug: 'montag',
  name: 'Montag Coffee Roasters',
  websiteUrl: 'https://montagcoffee.com',
  shopUrl: 'https://montagcoffee.com',
  platform: 'shopify',
  city: 'Istanbul',
  priceFormat: 'tl',
  productTypeFilter: ['filtre kahve', 'espresso kahve', 'kahve'],
};

export const aroastingLab: RoasterConfig = {
  slug: 'aroasting-lab',
  name: 'A Roasting Lab',
  websiteUrl: 'https://aroastinglab.com',
  shopUrl: 'https://aroastinglab.com',
  platform: 'shopify',
  city: 'Bursa',
  priceFormat: 'tl',
  // product_type is generic "product" — filter by tags instead
  tagFilters: ['kahve', 'coffee', 'filtre', 'espresso'],
};

export const coachCoffee: RoasterConfig = {
  slug: 'coach-coffee',
  name: 'Coach Coffee Company',
  websiteUrl: 'https://coachcoffeeco.com',
  shopUrl: 'https://coachcoffeeco.com',
  platform: 'shopify',
  city: 'Istanbul',
  priceFormat: 'tl',
  tagFilters: ['kahve', 'coffee'],
};

export const coffeenutz: RoasterConfig = {
  slug: 'coffeenutz',
  name: 'CoffeeNutz',
  websiteUrl: 'https://www.coffeenutz.net',
  shopUrl: 'https://www.coffeenutz.net',
  platform: 'shopify',
  city: 'Izmir',
  priceFormat: 'tl',
  productTypeFilter: ['taze kavrulmuş kahve', 'kahve'],
};

export const homestead: RoasterConfig = {
  slug: 'homestead',
  name: 'Homestead Coffee',
  websiteUrl: 'https://homestead.coffee',
  shopUrl: 'https://homestead.coffee',
  platform: 'shopify',
  city: 'Antalya',
  priceFormat: 'tl',
  productTypeFilter: ['coffee'],
};

export const nokCoffee: RoasterConfig = {
  slug: 'nok-coffee',
  name: 'Nok Coffee',
  websiteUrl: 'https://www.nokcoffee.com',
  shopUrl: 'https://www.nokcoffee.com',
  platform: 'shopify',
  city: 'Izmir',
  priceFormat: 'tl',
  productTypeFilter: ['single origin', 'arabica', 'kahve', 'coffee'],
};

export const boxx: RoasterConfig = {
  slug: 'boxx',
  name: 'Boxx Coffee Roasters',
  websiteUrl: 'https://boxxcoffee.com',
  shopUrl: 'https://boxxcoffee.com',
  platform: 'shopify',
  city: 'Istanbul',
  priceFormat: 'tl',
  productTypeFilter: ['specialty', 'kahve', 'coffee'],
};

// ==========================================
// WOOCOMMERCE ROASTERS (11)
// Price format varies — checked during research
// ==========================================

export const baristocrat: RoasterConfig = {
  slug: 'baristocrat',
  name: 'Baristocrat',
  websiteUrl: 'https://www.baristocrat.com',
  shopUrl: 'https://www.baristocrat.com',
  platform: 'woocommerce',
  city: 'Izmir',
  priceFormat: 'kurus', // 75000 = 750 TL
};

export const coffeeFriendzone: RoasterConfig = {
  slug: 'coffee-friendzone',
  name: 'Coffee Friendzone',
  websiteUrl: 'https://coffeefriendzone.com',
  shopUrl: 'https://coffeefriendzone.com',
  platform: 'woocommerce',
  city: 'Izmir',
  priceFormat: 'kurus',
};

export const coffeemamma: RoasterConfig = {
  slug: 'coffeemamma',
  name: 'Coffeemamma',
  websiteUrl: 'https://coffeemamma.com.tr',
  shopUrl: 'https://coffeemamma.com.tr',
  platform: 'woocommerce',
  city: 'Izmir',
  priceFormat: 'tl', // 520 = 520 TL
};

export const daphne: RoasterConfig = {
  slug: 'daphne',
  name: 'Daphne Coffee Co.',
  websiteUrl: 'https://daphnecoffee.co',
  shopUrl: 'https://daphnecoffee.co',
  platform: 'woocommerce',
  city: 'Ankara',
  priceFormat: 'tl', // 355 = 355 TL
};

export const oldJava: RoasterConfig = {
  slug: 'old-java',
  name: 'Old Java Coffee Roasters',
  websiteUrl: 'https://oldjavacoffee.com',
  shopUrl: 'https://oldjavacoffee.com',
  platform: 'woocommerce',
  city: 'Istanbul',
  priceFormat: 'kurus', // 60000 = 600 TL
};

export const ordinarius: RoasterConfig = {
  slug: 'ordinarius',
  name: 'Ordinarius Coffee Roastery',
  websiteUrl: 'https://ordinariuscoffee.com',
  shopUrl: 'https://ordinariuscoffee.com',
  platform: 'woocommerce',
  city: 'Eskisehir',
  priceFormat: 'kurus',
};

export const parsa: RoasterConfig = {
  slug: 'parsa',
  name: 'Parsa Coffee Roasters',
  websiteUrl: 'https://parsacoffeeroasters.com',
  shopUrl: 'https://parsacoffeeroasters.com',
  platform: 'woocommerce',
  city: 'Istanbul',
  priceFormat: 'kurus', // 80000 = 800 TL
};

export const poka: RoasterConfig = {
  slug: 'poka',
  name: 'Poka Coffee Roasters',
  websiteUrl: 'https://poka.coffee',
  shopUrl: 'https://poka.coffee',
  platform: 'woocommerce',
  city: 'Izmir',
  priceFormat: 'kurus', // 60000 = 600 TL
};

export const sezy: RoasterConfig = {
  slug: 'sezy',
  name: 'Sezy Coffee',
  websiteUrl: 'https://sezycoffee.com',
  shopUrl: 'https://sezycoffee.com',
  platform: 'woocommerce',
  city: 'Ankara',
  priceFormat: 'kurus', // 39000 = 390 TL
};

export const molecule: RoasterConfig = {
  slug: 'molecule',
  name: 'Molecule Coffee',
  websiteUrl: 'https://coffeemolecule.com',
  shopUrl: 'https://coffeemolecule.com',
  platform: 'woocommerce',
  city: 'Istanbul',
  priceFormat: 'tl', // 680 = 680 TL
};

export const williams: RoasterConfig = {
  slug: 'williams',
  name: 'Williams Roastery',
  websiteUrl: 'https://williamsroastery.com',
  shopUrl: 'https://williamsroastery.com',
  platform: 'woocommerce',
  city: 'Istanbul',
  priceFormat: 'tl', // 1200 = 1200 TL
};

// ==========================================
// IKAS ROASTERS (6)
// Parsed from __NEXT_DATA__ storefront payloads
// ==========================================

export const paper: RoasterConfig = {
  slug: 'paper',
  name: 'Paper Coffee & Chocolate',
  websiteUrl: 'https://paperroastingcoffee.com',
  shopUrl: 'https://paperroastingcoffee.com/online-magaza',
  platform: 'ikas',
  city: 'Ankara',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

export const story: RoasterConfig = {
  slug: 'story',
  name: 'Story Coffee Roasters',
  websiteUrl: 'https://storyroasters.com',
  shopUrl: 'https://storyroasters.com/nitelikli-kahve',
  platform: 'ikas',
  city: 'Istanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

export const spada: RoasterConfig = {
  slug: 'spada',
  name: 'Spada Coffee',
  websiteUrl: 'https://spadacoffee.com',
  shopUrl: 'https://spadacoffee.com/kahve',
  platform: 'ikas',
  city: 'Istanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

export const gourme: RoasterConfig = {
  slug: 'gourme',
  name: 'Gourme Coffee',
  websiteUrl: 'https://gourmecoffee.com',
  shopUrl: 'https://gourmecoffee.com/kahveler',
  platform: 'ikas',
  city: 'Istanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
  coffeeProductKeywords: [
    'etiyopya',
    'burundi',
    'kolombiya',
    'honduras',
    'brezilya',
    'endonezya',
    'kenya',
    'ruanda',
    'el salvador',
    'kosta rika',
  ],
};

export const hound: RoasterConfig = {
  slug: 'hound',
  name: 'Hound Coffee',
  websiteUrl: 'https://houndcoffee.com',
  shopUrl: 'https://houndcoffee.com/kahveler',
  platform: 'ikas',
  city: 'Ankara',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
  coffeeProductKeywords: [
    'costa rica',
    'kosta rika',
    'etiyopya',
    'endonezya',
    'kolombiya',
    'pau brasil',
  ],
};

export const kernel: RoasterConfig = {
  slug: 'kernel',
  name: 'Kernel Coffee',
  websiteUrl: 'https://kernelcoffee.co',
  shopUrl: 'https://kernelcoffee.co/kahve-1',
  platform: 'ikas',
  city: 'Istanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

// ==========================================
// CUSTOM ROASTERS
// ==========================================

export const kronotrop: RoasterConfig = {
  slug: 'kronotrop',
  name: 'Kronotrop',
  websiteUrl: 'https://kronotrop.com.tr',
  shopUrl: 'https://kronotrop.com.tr/alisveris/kategori/kahveler',
  platform: 'custom',
  city: 'Istanbul',
  priceFormat: 'tl',
  selectors: {
    productList: 'li.animationBorder:has(a.product-click)',
    productLink: 'a.product-click',
    productName: 'h2',
    productPrice: 'span.font-windsorRegular',
    productImage: 'img',
    description: '',
    unavailableText: 'Tükendi',
  },
};

export const probador: RoasterConfig = {
  slug: 'probador',
  name: 'Probador Colectiva',
  websiteUrl: 'https://probadorcolectiva.com',
  shopUrl: 'https://probadorcolectiva.com/urunler',
  platform: 'custom',
  city: 'Istanbul',
  priceFormat: 'tl',
  structuredDataParser: 'probador-products',
};

// ==========================================
// ALL CONFIGS — used by orchestrator
// ==========================================

export const ALL_ROASTER_CONFIGS: RoasterConfig[] = [
  // Shopify
  petra,
  montag,
  aroastingLab,
  coachCoffee,
  coffeenutz,
  homestead,
  nokCoffee,
  boxx,
  // WooCommerce
  baristocrat,
  coffeeFriendzone,
  coffeemamma,
  daphne,
  oldJava,
  ordinarius,
  parsa,
  poka,
  sezy,
  molecule,
  williams,
  // Ikas
  paper,
  story,
  spada,
  gourme,
  hound,
  kernel,
  // Custom
  kronotrop,
  probador,
];
