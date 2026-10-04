/** One coffee as a line of text: shared by the weekly digest, the monthly email and the issue page. */
import type { CatalogCoffee } from '../../shared/v2/catalog';
import type { CoffeeEvent } from '../../shared/v2/types';
import { coffeeOrigin, coffeeProcess, EVENT_LABELS, preferredOffer, publicOfferLabel, tasteSummary } from '../components/v2/discovery-card';
import { formatMoney } from './coffee-display';

export interface Item { coffee: CatalogCoffee; drop?: CoffeeEvent }
const money = (minor: unknown, currency: unknown) => typeof minor === 'number' && minor > 0 ? formatMoney(minor / 100, typeof currency === 'string' ? currency : '(para birimi belirtilmemiş)') : null;
const object = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export function itemLines(item: Item) {
  const { coffee, drop } = item;
  // The drop's own package is the one whose price changed; other coffees show the card's package.
  const offer = coffee.offers.find(o => drop?.offerId && o.variantOfferIds.includes(drop.offerId)) ?? preferredOffer(coffee);
  const tastes = tasteSummary(coffee);
  const before = object(drop?.before), after = object(drop?.after);
  // listCatalog already verified the event still matches the current price; re-check so a stale before→after never prints.
  const dropText = before && after && after.priceMinor === offer?.priceMinor ? `${money(before.priceMinor, before.currency)} → ${money(after.priceMinor, after.currency)}` : null;
  return {
    name: coffee.name, roaster: coffee.roaster.name,
    origin: [coffeeOrigin(coffee), coffeeProcess(coffee)].filter(Boolean).join(' · '),
    tastes: (tastes.length ? tastes : coffee.rawMetadata.tastingNotes?.slice(0, 3) ?? []).join(' · '),
    price: `${publicOfferLabel(offer)} · ${money(offer?.priceMinor, offer?.currency) ?? 'Fiyat paylaşılmamış'}`,
    drop: dropText && drop ? `${EVENT_LABELS[drop.type]}: ${dropText}` : null,
  };
}

