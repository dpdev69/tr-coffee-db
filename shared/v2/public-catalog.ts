import type { CatalogCoffee, CatalogOffer } from './catalog';

/** Explicit allowlist: internal collection dates, source archives, provenance and crawl health
 * never cross the public JSON boundary. Public roaster/coffee facts and original package prices do.
 */
export function publicCatalogCoffee(coffee:CatalogCoffee){
  const raw=coffee.rawMetadata;
  return {id:coffee.id,name:coffee.name,slug:coffee.slug,
    roaster:{id:coffee.roaster.id,slug:coffee.roaster.slug,name:coffee.roaster.name,websiteUrl:coffee.roaster.websiteUrl,city:coffee.roaster.city},
    facts:{description:raw.description??null,country:raw.country??null,region:raw.region??null,producer:raw.producer??null,farm:raw.farm??null,altitude:raw.altitude??null,varieties:raw.varieties??[],process:raw.process??null,tastingNotes:raw.tastingNotes??[],roast:raw.roast??null,roastDate:raw.roastDate??null,harvestYear:raw.harvestYear??null,decaf:raw.decaf??null,imageUrl:raw.imageUrl??null,...(typeof raw.scaScore==='number'&&Number.isFinite(raw.scaScore)&&raw.scaScore>0&&raw.scaScore<=100?{scaScore:raw.scaScore}:{})},
    offers:coffee.offers.map(publicCatalogOffer)};
}
export function publicCatalogOffer(offer:CatalogOffer){
  return {id:offer.id,label:offer.label,weightG:offer.weightG,currency:offer.currency,priceMinor:offer.priceMinor,compareAtMinor:offer.compareAtMinor,inStock:offer.inStock,purchaseUrl:offer.purchaseUrl};
}
export type PublicCatalogCoffee=ReturnType<typeof publicCatalogCoffee>;
