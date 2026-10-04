import { permanentRedirect } from 'next/navigation';

export default async function LegacyCatalog({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const next = new URLSearchParams();
  const aliases: Record<string,string> = { flavorCategory: 'taste', roastLevel: 'roast' };
  for (const [key,value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const part of Array.isArray(value) ? value : [value]) next.append(aliases[key] || key, part);
  }
  permanentRedirect(`/kahveler${next.size ? `?${next}` : ''}`);
}
