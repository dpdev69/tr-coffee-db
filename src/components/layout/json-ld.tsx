import { absoluteUrl } from '@/lib/site';
import { brand, studioOrganization } from '@/lib/brand';
import { publicOfferLabel } from '@/components/v2/discovery-card';
import { trustedCoffeeImageUrl } from '@/lib/coffee-image';
import type { CatalogCoffee } from '../../../shared/v2/catalog';

/** Structured data as a plain script tag (Next json-ld guide); `<` is escaped so catalog text cannot close the tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c') }} />;
}

/** KahveDrop as publisher or author, joined to the shared Basalt Studio node (src/lib/brand.ts) as its parent. */
export function siteOrganization() {
  return { '@type': 'Organization', name: brand.name, url: absoluteUrl('/'), parentOrganization: studioOrganization };
}

/** A page of the site: its own heading and description, in Turkish, published by KahveDrop. `dateModified` is when its
 * content last changed (for catalog pages: the catalog's last refresh), left out when unknown. */
export function webPage(name: string, description: string, path: string, { type = 'WebPage', dateModified }: { type?: 'WebPage' | 'CollectionPage'; dateModified?: string | null } = {}) {
  return { '@type': type, name, description, url: absoluteUrl(path), inLanguage: 'tr-TR', isPartOf: { '@type': 'WebSite', name: brand.name, url: absoluteUrl('/') },
    publisher: siteOrganization(), ...(dateModified ? { dateModified } : {}) };
}

export function breadcrumbList(items: [name: string, path: string][]) {
  return { '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], index) => ({ '@type': 'ListItem', position: index + 1, name, item: absoluteUrl(path) })) };
}

/** The entries a listing shows, in order; `offset` keeps positions running across pages, `total` is the count the page states. */
export function itemList(items: [name: string, path: string][], { offset = 0, total }: { offset?: number; total?: number } = {}) {
  return { '@type': 'ItemList', ...(total === undefined ? {} : { numberOfItems: total }), itemListElement: items.map(([name, path], index) => ({ '@type': 'ListItem', position: offset + index + 1, name, url: absoluteUrl(path) })) };
}

/** Only fields the catalog holds: name, image, roaster as brand, and each priced package the page lists as an offer (its own price and stock). */
export function productJsonLd(coffee: CatalogCoffee) {
  // The page shows an image only from an allowed host (the image route refuses the rest), so only that one is named.
  const image = coffee.rawMetadata.imageUrl ? trustedCoffeeImageUrl(coffee.rawMetadata.imageUrl)?.href : undefined;
  const offers = coffee.offers.filter(offer => offer.priceMinor != null && offer.priceMinor > 0 && offer.currency).map(offer => ({
    '@type': 'Offer', name: publicOfferLabel(offer), price: (offer.priceMinor! / 100).toFixed(2), priceCurrency: offer.currency,
    ...(offer.inStock === null ? {} : { availability: `https://schema.org/${offer.inStock ? 'InStock' : 'OutOfStock'}` }),
    ...(offer.purchaseUrl ? { url: offer.purchaseUrl } : {}),
    seller: { '@type': 'Organization', name: coffee.roaster.name },
  }));
  return { '@type': 'Product', name: coffee.name, url: absoluteUrl(`/kahve/${coffee.slug}`), brand: { '@type': 'Brand', name: coffee.roaster.name },
    ...(image ? { image } : {}), ...(offers.length ? { offers } : {}) };
}
