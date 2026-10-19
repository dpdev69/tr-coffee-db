import Link from 'next/link';
import { comparisonQuestion, comparisonsFor } from '@/lib/comparisons';

/** Links from a roaster, origin or process page to the written comparisons it is a side of. A fixed list: no catalog read. */
export function ComparisonLinks({ side, className = 'mt-12' }: { side: Parameters<typeof comparisonsFor>[0]; className?: string }) {
  const items = comparisonsFor(side);
  if (!items.length) return null;
  return <nav aria-label="Karşılaştırmalar" className={`${className} border-t border-line pt-8`}>
    <h2 className="mb-3 font-display text-2xl">Karşılaştır</h2>
    <ul className="flex flex-wrap gap-2">{items.map(item => <li key={item.slug}><Link href={`/karsilastir/${item.slug}`} prefetch={false} className="filter-option">{comparisonQuestion(item)}</Link></li>)}</ul>
  </nav>;
}
