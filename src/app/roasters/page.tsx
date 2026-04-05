import type { Metadata } from 'next';
import Link from 'next/link';
import { getRoasters } from '@/lib/queries/roasters';

export const metadata: Metadata = {
  title: 'Roasters',
  description:
    'Browse specialty coffee roasters across Turkey. Istanbul, Ankara, Izmir, and more.',
};

export default async function RoastersPage() {
  let roasters: Awaited<ReturnType<typeof getRoasters>> = [];

  try {
    roasters = await getRoasters();
  } catch {
    // Supabase not configured
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-stone-900">Roasters</h1>
      <p className="mt-2 text-sm text-stone-500">
        {roasters.length} specialty coffee roasters across Turkey
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roasters.map((roaster) => {
          const coffeeCount = roaster.coffees?.[0]?.count ?? 0;
          return (
            <Link
              key={roaster.id}
              href={`/roasters/${roaster.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-stone-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-50 text-xl font-bold text-amber-700">
                {roaster.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-stone-900 group-hover:text-amber-700">
                  {roaster.name}
                </h2>
                <p className="text-sm text-stone-500">
                  {roaster.city}
                  {coffeeCount > 0 && ` \u00b7 ${coffeeCount} coffees`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {roasters.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-stone-500">
            No roasters found. Connect Supabase to load data.
          </p>
        </div>
      )}
    </div>
  );
}
