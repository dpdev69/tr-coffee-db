import { createClient } from '@/lib/supabase/server';
import type { Roaster } from '@/lib/types/database';

export async function getRoasters() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('roasters')
    .select('*, coffees(count)')
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return (data ?? []) as (Roaster & { coffees: { count: number }[] })[];
}

export async function getRoasterBySlug(slug: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('roasters')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) return null;
  return data as Roaster;
}
