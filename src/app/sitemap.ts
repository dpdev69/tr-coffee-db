import { coffeeOnlySql } from '../../shared/v2/coffee-eligibility';
import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';
import { getCatalogDatabase } from '@/lib/v2-runtime';

export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes: MetadataRoute.Sitemap = ['/', '/yeni', '/firsatlar', '/kahveler', '/kavurucular', '/quiz', '/guide', '/privacy', '/terms'].map(path => ({url:absoluteUrl(path), changeFrequency:'weekly', priority:path==='/'?1:0.7}));
  try {
    const db=await getCatalogDatabase();
    const coffees=await db.prepare(`SELECT c.slug FROM coffees c WHERE c.visibility='public' AND ${coffeeOnlySql()}`).all<{slug:string}>();
    const roasters=await db.prepare('SELECT slug FROM roasters WHERE active=1').all<{slug:string}>();
    return [...routes,...coffees.results.map(c=>({url:absoluteUrl(`/kahve/${encodeURIComponent(c.slug)}`)})),...roasters.results.map(r=>({url:absoluteUrl(`/kavurucu/${encodeURIComponent(r.slug)}`)}))];
  } catch { return routes; }
}
