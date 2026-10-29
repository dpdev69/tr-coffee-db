import type { RoasterConfig } from '../types.js';

// ==========================================
// SHOPIFY ROASTERS (12) — all prices in TL
// ==========================================

export const petra: RoasterConfig = {
  slug: 'petra',
  name: 'Petra Coffee',
  websiteUrl: 'https://petracoffee.com',
  shopUrl: 'https://petracoffee.com',
  platform: 'shopify',
  city: 'İstanbul',
  priceFormat: 'tl',
  productTypeFilter: ['kahve', 'coffee'],
};

export const montag: RoasterConfig = {
  slug: 'montag',
  name: 'Montag Coffee Roasters',
  websiteUrl: 'https://montagcoffee.com',
  shopUrl: 'https://montagcoffee.com',
  platform: 'shopify',
  city: 'İstanbul',
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
  city: 'İstanbul',
  priceFormat: 'tl',
  tagFilters: ['kahve', 'coffee'],
};

export const coffeenutz: RoasterConfig = {
  slug: 'coffeenutz',
  name: 'CoffeeNutz',
  websiteUrl: 'https://www.coffeenutz.net',
  shopUrl: 'https://www.coffeenutz.net',
  platform: 'shopify',
  city: 'İzmir',
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
  city: 'İzmir',
  priceFormat: 'tl',
  productTypeFilter: ['single origin', 'arabica', 'kahve', 'coffee'],
};

export const boxx: RoasterConfig = {
  slug: 'boxx',
  name: 'Boxx Coffee Roasters',
  websiteUrl: 'https://boxxcoffee.com',
  shopUrl: 'https://boxxcoffee.com',
  platform: 'shopify',
  city: 'İstanbul',
  priceFormat: 'tl',
  productTypeFilter: ['specialty', 'kahve', 'coffee'],
};

export const nullCoffee: RoasterConfig = {
  slug: 'null-coffee',
  name: 'Null Coffee Roasters',
  websiteUrl: 'https://null.coffee',
  shopUrl: 'https://null.coffee',
  platform: 'shopify',
  city: 'İstanbul',
  priceFormat: 'tl',
  productTypeFilter: ['specialty coffee'],
};

export const kimma: RoasterConfig = {
  slug: 'kimma',
  name: 'Kimma Coffee Roasters',
  websiteUrl: 'https://kimmacoffee.com',
  shopUrl: 'https://shop.kimmacoffee.com',
  platform: 'shopify',
  city: 'İstanbul',
  priceFormat: 'tl',
};

export const cupOfJoy: RoasterConfig = {
  slug: 'cup-of-joy',
  name: 'Cup of Joy',
  websiteUrl: 'https://cupofjoy.com.tr',
  shopUrl: 'https://cupofjoy.com.tr',
  platform: 'shopify',
  city: 'İstanbul',
  priceFormat: 'tl',
  productTypeFilter: ['kahve'],
};

export const coffeeSapiens: RoasterConfig = {
  slug: 'coffee-sapiens',
  name: 'Coffee Sapiens',
  websiteUrl: 'https://www.coffeesapiens.com',
  shopUrl: 'https://www.coffeesapiens.com',
  platform: 'shopify',
  city: 'İstanbul',
  priceFormat: 'tl',
  // No product_type or tags; the full catalog also lists zero-price brew guides ("FRENCH PRESS") that would read as coffees.
  collectionHandle: 'coffee-collection',
};

// ==========================================
// WOOCOMMERCE ROASTERS (12)
// Price format varies — checked during research
// ==========================================

export const baristocrat: RoasterConfig = {
  slug: 'baristocrat',
  name: 'Baristocrat',
  websiteUrl: 'https://www.baristocrat.com',
  shopUrl: 'https://www.baristocrat.com',
  platform: 'woocommerce',
  city: 'İzmir',
  priceFormat: 'kurus', // 75000 = 750 TL
};

export const coffeeFriendzone: RoasterConfig = {
  slug: 'coffee-friendzone',
  name: 'Coffee Friendzone',
  websiteUrl: 'https://coffeefriendzone.com',
  shopUrl: 'https://coffeefriendzone.com',
  platform: 'woocommerce',
  city: 'İzmir',
  priceFormat: 'kurus',
};

export const coffeemamma: RoasterConfig = {
  slug: 'coffeemamma',
  name: 'Coffeemamma',
  websiteUrl: 'https://coffeemamma.com.tr',
  shopUrl: 'https://coffeemamma.com.tr',
  platform: 'woocommerce',
  city: 'İzmir',
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
  city: 'İstanbul',
  priceFormat: 'kurus', // 60000 = 600 TL
  // This uncategorized wholesale offer has only 1×60 kg, 5×60 kg, and 10×60 kg options.
  // Source: https://oldjavacoffee.com/urun/cafe-abyssinia-etiopia/
  excludedProductSlugs: ['cafe-abyssinia-etiopia'],
};

export const ordinarius: RoasterConfig = {
  slug: 'ordinarius',
  // robots.txt asks every crawler for Crawl-delay: 30, and a complete crawl needs about 180 requests (every size and grind is
  // its own page): about 90 minutes, far over the nightly job. At our usual pace the shop answered HTTP 429 (2026-10-20).
  // Off until the roaster allows a faster pace or offers a feed; the IdeaSoft adapter below stays ready.
  active: false,
  name: 'Ordinarius Coffee Roastery',
  websiteUrl: 'https://ordinariuscoffee.com',
  shopUrl: 'https://www.ordinariuscoffee.com/kategori/kahve',
  platform: 'custom',
  city: 'Eskişehir',
  priceFormat: 'kurus',
  selectors: {productList:'.showcase',productLink:'.showcase-title a',productName:'.showcase-title',productPrice:'.showcase-price',productImage:'img',description:''},
};

export const parsa: RoasterConfig = {
  slug: 'parsa',
  name: 'Parsa Coffee Roasters',
  websiteUrl: 'https://parsacoffeeroasters.com',
  shopUrl: 'https://parsacoffeeroasters.com/tr/magaza',
  platform: 'custom',
  city: 'İstanbul',
  priceFormat: 'tl',
  structuredDataParser: 'parsa-catalog',
};

export const poka: RoasterConfig = {
  slug: 'poka',
  name: 'Poka Coffee Roasters',
  websiteUrl: 'https://poka.coffee',
  shopUrl: 'https://poka.coffee',
  platform: 'woocommerce',
  city: 'İzmir',
  priceFormat: 'kurus', // 60000 = 600 TL
};

export const lotCoffee: RoasterConfig = {
  slug: 'lot-coffee',
  name: 'Lot Coffee Roastery',
  websiteUrl: 'https://lotcoffeeroastery.com',
  shopUrl: 'https://lotcoffeeroastery.com',
  platform: 'woocommerce',
  city: null,
  priceFormat: 'kurus', // 92500 = 925 TL
  // Single origins are named by origin/farm only; the store files every coffee under the "Specialty" category.
  coffeeProductKeywords: ['specialty'],
  // "Hola! Colombia" is a three-coffee sampler (100 g + 100 g + 50 g) filed under Specialty, not one 250 g coffee.
  excludedProductSlugs: ['holacolombia'],
};

export const sezy: RoasterConfig = {
  slug: 'sezy',
  // Refuses GitHub's network and the relay (HTTP 403 nightly since 2026-10-04); off until the roaster allows the crawler (owner, 2026-10-17).
  active: false,
  runsFrom: 'relay',
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
  city: 'İstanbul',
  priceFormat: 'tl', // 680 = 680 TL
};

export const williams: RoasterConfig = {
  slug: 'williams',
  name: 'Williams Roastery',
  websiteUrl: 'https://williamsroastery.com',
  shopUrl: 'https://williamsroastery.com',
  platform: 'woocommerce',
  crawlDelayMs: 3000, // robots.txt: Crawl-delay: 3 (2026-10-20)
  city: 'İstanbul',
  priceFormat: 'tl', // 1200 = 1200 TL
};

// ==========================================
// IKAS ROASTERS (13)
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
  city: 'İstanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

export const spada: RoasterConfig = {
  slug: 'spada',
  name: 'Spada Coffee',
  websiteUrl: 'https://spadacoffee.com',
  shopUrl: 'https://spadacoffee.com/kahve',
  platform: 'ikas',
  city: 'İstanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

export const gourme: RoasterConfig = {
  slug: 'gourme',
  name: 'Gourme Coffee',
  websiteUrl: 'https://gourmecoffee.com',
  shopUrl: 'https://gourmecoffee.com/kahveler',
  platform: 'ikas',
  city: 'İstanbul',
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
  city: 'İstanbul',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

export const orkunUstel: RoasterConfig = {
  slug: 'orkun-ustel',
  name: 'Orkun Üstel',
  websiteUrl: 'https://orkunustel.com',
  shopUrl: 'https://orkunustel.com/nitelikli-kahve',
  platform: 'ikas',
  city: 'İstanbul',
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
  city: 'İstanbul',
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
  city: null,
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

export const caffeDiToee: RoasterConfig = {
  slug: 'caffe-di-toee',
  name: 'Caffe Di Toee',
  websiteUrl: 'https://caffeditoee.com',
  shopUrl: 'https://caffeditoee.com/kahveler',
  platform: 'ikas',
  city: 'Ankara',
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

export const mayard: RoasterConfig = {
  slug: 'mayard',
  name: 'Mayard Coffee',
  websiteUrl: 'https://mayardcoffee.com',
  shopUrl: 'https://mayardcoffee.com/cekirdek',
  platform: 'ikas',
  city: null,
  priceFormat: 'tl',
  structuredDataParser: 'next-data-products',
};

export const vitus: RoasterConfig = {
  slug: 'vitus',
  name: 'Vitus Coffee & Roastery',
  websiteUrl: 'https://vituscoffee.com',
  shopUrl: 'https://vituscoffee.com/niteliklikahveler',
  platform: 'ikas',
  city: null,
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
  city: 'İstanbul',
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
  city: 'İstanbul',
  priceFormat: 'tl',
  structuredDataParser: 'probador-products',
};

export const kafeinKultur: RoasterConfig = {
  slug: 'kafeinkultur',
  name: 'KafeinKültür',
  websiteUrl: 'https://www.kafeinkultur.com',
  shopUrl: 'https://www.kafeinkultur.com/kafeinkultur',
  platform: 'custom',
  city: 'İstanbul',
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
  // Refuses GitHub's network and the relay (HTTP 403 nightly since 2026-10-04); off until the roaster allows the crawler (owner, 2026-10-17).
  active: false,
  runsFrom: 'relay',
  name: 'Coffeerem Roastery',
  websiteUrl: 'https://coffeerem.com',
  shopUrl: 'https://coffeerem.com/magaza/',
  platform: 'woocommerce',
  city: 'İzmir',
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
  city: 'İstanbul',
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
  // Refuses GitHub's network (HTTPS timeouts and resets) and the relay (HTTP 403) since 2026-10-27; off until the
  // roaster allows the crawler (2026-10-29).
  active: false,
  runsFrom: 'relay',
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
  // Storefront answers this crawler with HTTP 403 (also from a home connection, 2026-09-26); never qualified.
  active: false,
  websiteUrl: 'https://chocoffeeroastery.com',
  shopUrl: 'https://chocoffeeroastery.com/tr/kahve',
  platform: 'custom',
  city: 'İstanbul',
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
    nextPage: '.pager .next-page a',
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
  coffeeSapiens,
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
  lotCoffee,
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
  caffeDiToee,
  mayard,
  vitus,
  // Custom
  kronotrop,
  probador,
  kafeinKultur,
  coffeerem,
  coffeeDepartment,
  milestones,
  choCoffee,
];
