import Link from 'next/link';
import { comparisonQuestion, comparisonsFor } from '@/lib/comparisons';
import { featureText } from '@/components/v2/discovery-card';
import type { CatalogCoffee } from '../../../shared/v2/catalog';

/** Links from a roaster, origin, process or coffee page to the written comparisons it is a side of. A fixed list: no catalog read. */
export function ComparisonLinks({ side, className = 'mt-12' }: { side: Parameters<typeof comparisonsFor>[0]; className?: string }) {
  const items = comparisonsFor(side);
  if (!items.length) return null;
  return <nav aria-label="Karşılaştırmalar" className={`${className} border-t border-line pt-8`}>
    <h2 className="mb-3 font-display text-2xl">Karşılaştır</h2>
    <ul className="flex flex-wrap gap-2">{items.map(item => <li key={item.slug}><Link href={`/karsilastir/${item.slug}`} prefetch={false} className="filter-option">{comparisonQuestion(item)}</Link></li>)}</ul>
  </nav>;
}

/** A coffee's sides, with the precedence its page shows them (coffeeOrigin, coffeeProcess): the roaster's own statement,
 * else the normalized fact, else the raw one. A coffee only links to a comparison whose side the page itself names. */
export function coffeeSides(coffee: CatalogCoffee): Parameters<typeof comparisonsFor>[0] {
  const pick = (declared: string | null | undefined, ...names: string[]) => declared != null ? [declared] : names.map(name => featureText(coffee, name)).find(values => values.length) ?? [];
  return { roaster: coffee.roaster.slug, origin: pick(coffee.rawMetadata.country, 'normalized_origin', 'origin_country'), process: pick(coffee.rawMetadata.process, 'process_family', 'process') };
}
