import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { getRoasters } from '@/lib/queries/roasters';
import { RoasterAvatar } from '@/components/roaster/roaster-avatar';
import { SITE_NAME } from '@/lib/site';
import { DataSourceNotice } from '@/components/ui/data-source-notice';

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
  let roastersUnavailable = false;

  try {
    roasters = await getRoasters();
  } catch (error) {
    unstable_rethrow(error);
    roastersUnavailable = true;
    console.error('Roaster list failed to load', {
      error: getErrorMessage(error),
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7c3a20]">
          Kavurucular
        </p>
        <h1 className="mt-3 font-display text-5xl leading-none text-[#1f1d1b]">
          Takipteki kahve markaları.
        </h1>
      </div>
      {roastersUnavailable ? (
        <div className="mt-6 max-w-3xl">
          <DataSourceNotice
            title="Kavurucu listesi geçici olarak yüklenemiyor."
            message="Katalog veri kaynağına şu an ulaşamadık. Bu sıfır kavurucu olduğu anlamına gelmez; bağlantı düzeldiğinde liste yeniden görünür."
            actionHref="/roasters"
            actionLabel="Kavurucuları tekrar dene"
          />
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-[#5d5853]">
            Türkiye genelinde takip edilen {roasters.length} bağımsız kavurucu
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roasters.map((roaster) => {
              const coffeeCount = roaster.coffees?.[0]?.count ?? 0;
              return (
                <Link
                  key={roaster.id}
                  href={`/roasters/${roaster.slug}`}
                  className="group flex items-center gap-4 rounded-[22px] border border-[#1f1d1b]/10 bg-white p-5 transition-colors hover:border-[#1f1d1b]/25"
                >
                  <RoasterAvatar name={roaster.name} logoUrl={roaster.logo_url} />
                  <div className="min-w-0">
                    <h2 className="font-semibold text-[#1f1d1b] group-hover:underline group-hover:underline-offset-4">
                      {roaster.name}
                    </h2>
                    <p className="text-sm text-[#5d5853]">
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
              <p className="text-[#5d5853]">
                Henüz kavurucu bulunamadı.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
