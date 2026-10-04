import { legacyCatalogDatabase, legacyRoasters, legacyRoasterDetail } from '@/lib/v2-legacy';
import { getCurrentCatalogCutoffIso } from '@/lib/catalog-rules';
import { applyPublicCoffeeVisibility } from '@/lib/public-coffee-visibility';
import type { Roaster } from '@/lib/types/database';

export async function getRoasters() {
  const db = await legacyCatalogDatabase();
  if (db) return legacyRoasters(db);
  const supabase = await (await import('@/lib/supabase/server')).createClient();
  const currentCutoff = getCurrentCatalogCutoffIso();

  const [
    { data: roasters, error: roastersError },
    { data: coffees, error: coffeesError },
  ] = await Promise.all([
    supabase.from('roasters').select('*').eq('is_active', true).order('name'),
    applyPublicCoffeeVisibility(
      supabase
        .from('coffees')
        .select('roaster_id'),
      currentCutoff
    ),
  ]);

  if (roastersError) throw roastersError;
  if (coffeesError) throw coffeesError;

  const counts = new Map<string, number>();
  for (const coffee of (coffees ?? []) as { roaster_id: string }[]) {
    counts.set(coffee.roaster_id, (counts.get(coffee.roaster_id) ?? 0) + 1);
  }

  return ((roasters ?? []) as Roaster[]).map((roaster) => ({
    ...roaster,
    coffees: [{ count: counts.get(roaster.id) ?? 0 }],
  }));
}

export async function getRoasterBySlug(slug: string) {
  const db = await legacyCatalogDatabase();
  if (db) return legacyRoasterDetail(db, slug);
  const supabase = await (await import('@/lib/supabase/server')).createClient();

  const { data, error } = await supabase
    .from('roasters')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) return null;
  return data as Roaster;
}
