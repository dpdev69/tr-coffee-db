import Link from 'next/link';
import { getFeaturedCoffees, getStats } from '@/lib/queries/coffees';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL.origin,
  description: SITE_DESCRIPTION,
  inLanguage: 'tr-TR',
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL.origin}/coffees?search={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL.origin,
  },
};

export default async function HomePage() {
  let stats = { totalCoffees: 0, totalRoasters: 0, totalOrigins: 0 };
  let featured: Awaited<ReturnType<typeof getFeaturedCoffees>> = [];

  try {
    [stats, featured] = await Promise.all([getStats(), getFeaturedCoffees(6)]);
  } catch {
    // Supabase not configured yet — render static content
  }

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Hero */}
      <section className="relative overflow-hidden bg-stone-900 px-4 py-24 text-center sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.18),transparent_38%),linear-gradient(135deg,rgba(41,37,36,0.92),rgba(12,10,9,0.98))]" />
        <div className="absolute inset-y-0 left-[-8%] w-1/3 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute right-[-10%] top-8 h-48 w-48 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Yeni kahveni
            <span className="block text-amber-400">20 sekmede arama.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-stone-300">
            Türkiye&apos;deki bağımsız kavurucuların güncel çekirdeklerini tek yerde
            karşılaştır. Köken, işleme, kavrum, tat ve 100 g fiyatıyla hızlıca daralt.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/coffees"
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
            >
              Kahveleri Karşılaştır
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 rounded-lg border border-stone-600 px-8 py-3 text-sm font-semibold text-stone-300 transition-colors hover:border-stone-400 hover:text-white"
            >
              Tercihime Göre Bul
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-stone-200 bg-stone-50">
        <div className="mx-auto grid max-w-4xl grid-cols-3 divide-x divide-stone-200 py-8">
          <StatBlock number={stats.totalCoffees || '100+'} label="Kahve" />
          <StatBlock number={stats.totalRoasters || '20+'} label="Kavurucu" />
          <StatBlock number={stats.totalOrigins || '25+'} label="Köken" />
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-bold text-stone-900">Yeni Eklenenler</h2>
            <Link
              href="/coffees"
              className="text-sm font-medium text-amber-700 hover:text-amber-800"
            >
              Tümünü Gör &rarr;
            </Link>
          </div>
          <div className="mt-8">
            <CoffeeGrid coffees={featured} />
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="bg-stone-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-stone-900">Nasıl Çalışır</h2>
          <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <Step
              step="1"
              title="Tek Yerde Ara"
              description="Kavurucu sitelerini tek tek açmadan köken, işleme, kavrum, tat ve demleme yöntemine göre daralt."
            />
            <Step
              step="2"
              title="Adil Karşılaştır"
              description="250 g, 500 g ya da 1 kg paketleri aynı zeminde görmek için 100 g normalize fiyatı kullan."
            />
            <Step
              step="3"
              title="Kavurucudan Al"
              description="Beğendiğin çekirdeğe karar verince doğrudan kavurucunun sitesine geç. Arada mağaza yok."
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatBlock({ number, label }: { number: number | string; label: string }) {
  return (
    <div className="px-4 text-center">
      <div className="text-3xl font-bold text-stone-900">{number}</div>
      <div className="mt-1 text-sm text-stone-500">{label}</div>
    </div>
  );
}

function Step({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">
        {step}
      </div>
      <h3 className="mt-4 font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 text-sm text-stone-500">{description}</p>
    </div>
  );
}
