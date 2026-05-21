import type { Metadata } from 'next';
import Link from 'next/link';
import { getRoasters } from '@/lib/queries/roasters';
import { RoasterAvatar } from '@/components/roaster/roaster-avatar';
import { SITE_NAME } from '@/lib/site';

const description =
  'Türkiye’deki bağımsız nitelikli kahve kavurucularını ve güncel çekirdeklerini tek yerden inceleyin.';

export const metadata: Metadata = {
  title: 'Kavurucular',
  description,
  alternates: {
    canonical: '/roasters',
  },
  openGraph: {
    title: `Kavurucular | ${SITE_NAME}`,
    description,
    url: '/roasters',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Kavurucular | ${SITE_NAME}`,
    description,
  },
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
      <h1 className="text-2xl font-bold text-stone-900">Kavurucular</h1>
      <p className="mt-2 text-sm text-stone-500">
        Türkiye genelinde takip edilen {roasters.length} bağımsız kavurucu
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
              <RoasterAvatar name={roaster.name} logoUrl={roaster.logo_url} />
              <div className="min-w-0">
                <h2 className="font-semibold text-stone-900 group-hover:text-amber-700">
                  {roaster.name}
                </h2>
                <p className="text-sm text-stone-500">
                  {roaster.city}
                  {coffeeCount > 0 && ` \u00b7 ${coffeeCount} kahve`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {roasters.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-stone-500">
            Kavurucu bulunamadı. Verileri yüklemek için Supabase bağlantısını kurun.
          </p>
        </div>
      )}
    </div>
  );
}
