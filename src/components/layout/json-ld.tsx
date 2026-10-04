import { absoluteUrl } from '@/lib/site';

/** Structured data as a plain script tag (Next json-ld guide); `<` is escaped so catalog text cannot close the tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c') }} />;
}

export function breadcrumbList(items: [name: string, path: string][]) {
  return { '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], index) => ({ '@type': 'ListItem', position: index + 1, name, item: absoluteUrl(path) })) };
}
