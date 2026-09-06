import type { RoasterConfig } from '../types.js';

// ==========================================
// SHOPIFY ROASTERS (11) — all prices in TL
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

export const nullCoffee: RoasterConfig = {
  slug: 'null-coffee',
  name: 'Null Coffee Roasters',
  websiteUrl: 'https://null.coffee',
  shopUrl: 'https://null.coffee',
  platform: 'shopify',
  city: 'Istanbul',
  priceFormat: 'tl',
  productTypeFilter: ['specialty coffee'],
};

export const kimma: RoasterConfig = {
  slug: 'kimma',
  name: 'Kimma Coffee Roasters',
  websiteUrl: 'https://kimmacoffee.com',
  shopUrl: 'https://shop.kimmacoffee.com',
  platform: 'shopify',
  city: 'Istanbul',
  priceFormat: 'tl',
};

export const cupOfJoy: RoasterConfig = {
  slug: 'cup-of-joy',
  name: 'Cup of Joy',
  websiteUrl: 'https://cupofjoy.com.tr',
  shopUrl: 'https://cupofjoy.com.tr',
  platform: 'shopify',
  city: 'Istanbul',
  priceFormat: 'tl',
  productTypeFilter: ['kahve'],
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
  // This uncategorized wholesale offer has only 1×60 kg, 5×60 kg, and 10×60 kg options.
  // Source: https://oldjavacoffee.com/urun/cafe-abyssinia-etiopia/
  excludedProductSlugs: ['cafe-abyssinia-etiopia'],
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
  shopUrl: 'https://parsacoffeeroasters.com/tr/magaza',
  platform: 'custom',
  city: 'Istanbul',
  priceFormat: 'tl',
  structuredDataParser: 'parsa-catalog',
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
// IKAS ROASTERS (10)
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

export const orkunUstel: RoasterConfig = {
  slug: 'orkun-ustel',
  name: 'Orkun Üstel',
  websiteUrl: 'https://orkunustel.com',
  shopUrl: 'https://orkunustel.com/nitelikli-kahve',
  platform: 'ikas',
  city: 'Istanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
  coffeeProductKeywords: [
    'nitelikli kahve',
    'filtre',
    'espresso',
    'etiyopya',
    'kenya',
    'kolombiya',
    'kosta rika',
    'peru',
    'tanzanya',
    'brezilya',
  ],
};

export const calibre: RoasterConfig = {
  slug: 'calibre',
  name: 'Calibre Coffee',
  websiteUrl: 'https://coffeecalibre.com',
  shopUrl: 'https://coffeecalibre.com',
  platform: 'ikas',
  city: 'Istanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
  coffeeProductKeywords: [
    'nitelikli kahve',
    'kahve',
    'coffee',
    'filtre',
    'espresso',
    'colombia',
    'honduras',
    'panama',
  ],
};

export const a4Kahve: RoasterConfig = {
  slug: 'a4-kahve',
  name: 'A4 Kahve',
  websiteUrl: 'https://a4kahve.com',
  shopUrl: 'https://a4kahve.com',
  platform: 'ikas',
  city: 'Unknown',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
  coffeeProductKeywords: [
    'kahve',
    'coffee',
    'filtre',
    'espresso',
    'kosta rika',
    'peru',
    'brezilya',
    'etiyopya',
  ],
};

export const tetraN: RoasterConfig = {
  slug: 'tetra-n',
  name: 'Tetra N Roastery',
  websiteUrl: 'https://tetranroastery.com',
  shopUrl: 'https://tetranroastery.com',
  platform: 'ikas',
  city: 'Ankara',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
  coffeeProductKeywords: ['kahve', 'coffee', 'roastery', 'filtre', 'espresso'],
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
  derivePackageFromProductPage: true,
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

export const kafeinKultur: RoasterConfig = {
  slug: 'kafeinkultur',
  name: 'KafeinKültür',
  websiteUrl: 'https://www.kafeinkultur.com',
  shopUrl: 'https://www.kafeinkultur.com/kafeinkultur',
  platform: 'custom',
  city: 'Istanbul',
  priceFormat: 'tl',
  derivePackageFromProductPage: true,
  selectors: {
    productList: '.product-card.default',
    productLink: 'a.product-title',
    productName: 'a.product-title',
    productPrice: '.regular-price',
    productImage: 'a.thumb img',
    description: '',
    unavailableText: 'Stokta yok',
  },
};

export const coffeerem: RoasterConfig = {
  slug: 'coffeerem',
  name: 'Coffeerem Roastery',
  websiteUrl: 'https://coffeerem.com',
  shopUrl: 'https://coffeerem.com/magaza/',
  platform: 'custom',
  city: 'Izmir',
  priceFormat: 'tl',
  derivePackageFromProductPage: true,
  selectors: {
    productList: '.dt-css-grid .wf-cell',
    productLink: '.entry-title a',
    productName: '.entry-title a',
    productPrice: '.price',
    productImage: 'a.alignnone img',
    description: '',
    unavailableText: 'Stokta yok',
    nextPage: 'a.next.page-numbers',
  },
};

export const coffeeDepartment: RoasterConfig = {
  slug: 'coffee-department',
  name: 'Coffee Department',
  websiteUrl: 'https://coffeedepartment.co',
  shopUrl: 'https://coffeedepartment.co/kahveler',
  platform: 'custom',
  city: 'Istanbul',
  priceFormat: 'tl',
  derivePackageFromProductPage: true,
  selectors: {
    productList: '.productItem',
    productLink: '.productName a',
    productName: '.productName a',
    productPrice: '.discountPriceSpan',
    productImage: '.productImage img',
    description: '.productOnYazi',
  },
};

export const milestones: RoasterConfig = {
  slug: 'milestones',
  name: 'Milestones Coffee',
  websiteUrl: 'https://milestonescoffee.com',
  shopUrl: 'https://milestonescoffee.com/kategori/kahveler-57/',
  platform: 'custom',
  city: 'Manisa',
  priceFormat: 'tl',
  derivePackageFromProductPage: true,
  selectors: {
    productList: '.product-wrapper.row > .product-wrap',
    productLink: 'h3.product-name a',
    productName: 'h3.product-name a',
    productPrice: '.product-price',
    productImage: '.product-media img',
    description: '',
    unavailableText: 'Tükendi',
  },
};

export const choCoffee: RoasterConfig = {
  slug: 'cho-coffee',
  name: 'Cho Coffee Roastery',
  websiteUrl: 'https://chocoffeeroastery.com',
  shopUrl: 'https://chocoffeeroastery.com/tr/kahve',
  platform: 'custom',
  city: 'Istanbul',
  priceFormat: 'tl',
  derivePackageFromProductPage: true,
  selectors: {
    productList: '.product-item',
    productLink: '.product-title a',
    productName: '.product-title a',
    productPrice: '.price.actual-price',
    productImage: '.picture img.picture-img',
    description: '.description',
    unavailableText: 'SOULD OUT',
  },
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
  nullCoffee,
  kimma,
  cupOfJoy,
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
  orkunUstel,
  calibre,
  a4Kahve,
  tetraN,
  // Custom
  kronotrop,
  probador,
  kafeinKultur,
  coffeerem,
  coffeeDepartment,
  milestones,
  choCoffee,
];
