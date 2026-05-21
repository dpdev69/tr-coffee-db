import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCoffeeBySlug, getSimilarCoffees } from '@/lib/queries/coffees';
import { BuyButton } from '@/components/coffee/buy-button';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { Tag } from '@/components/ui/tag';
import { BREW_METHOD_LABELS, PROCESS_LABELS, ROAST_LABELS } from '@/lib/constants/filter-options';
import { SITE_NAME } from '@/lib/site';
import type { CoffeeBrewRecipe } from '@/lib/types/database';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const coffee = await getCoffeeBySlug(slug);
  if (!coffee) return { title: 'Kahve Bulunamadı' };

  const title = coffee.name_normalized ?? coffee.name;
  const roaster = coffee.roasters.name;
  const description = `${roaster} kavurucusundan ${title}. ${
    coffee.origin_country ? `${coffee.origin_country} kökenli. ` : ''
  }${coffee.process !== 'unknown' ? `${PROCESS_LABELS[coffee.process] ?? coffee.process} işleme. ` : ''}${
    coffee.price_per_100g ? `${coffee.price_per_100g.toLocaleString('tr-TR')} TL/100 g. ` : ''
  }Güncel çekirdekleri TR CoffeeDB'de karşılaştırın.`;

  return {
    title: `${title} | ${roaster}`,
    description,
    alternates: {
      canonical: `/coffees/${slug}`,
    },
    openGraph: {
      title: `${title} | ${roaster}`,
      description,
      url: `/coffees/${slug}`,
      siteName: SITE_NAME,
      images: coffee.image_url ? [coffee.image_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${roaster}`,
      description,
      images: coffee.image_url ? [coffee.image_url] : [],
    },
  };
}

export default async function CoffeeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const coffee = await getCoffeeBySlug(slug);
  if (!coffee) notFound();

  const similar = await getSimilarCoffees(coffee, 4);
  const roaster = coffee.roasters as { id: string; name: string; slug: string; city: string; website_url: string; logo_url: string | null };
  const brewRecipes = coffee.brew_recipes ?? [];
  const completenessBadges = getCompletenessBadges(coffee);
  const completenessScore = Math.round(
    (completenessBadges.filter((badge) => badge.available).length / completenessBadges.length) * 100
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/coffees" className="hover:text-stone-700">
          Kahveler
        </Link>
        <span className="mx-2">/</span>
        <span className="text-stone-900">{coffee.name_normalized ?? coffee.name}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
          {coffee.image_url ? (
            <Image
              src={coffee.image_url}
              alt={coffee.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-stone-300">
              <svg className="h-24 w-24" fill="none" viewBox="0 0 24 24" strokeWidth="1" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
              </svg>
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <Link
            href={`/roasters/${roaster.slug}`}
            className="text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            {roaster.name} &middot; {roaster.city}
          </Link>

          <h1 className="mt-2 text-3xl font-bold text-stone-900">
            {coffee.name_normalized ?? coffee.name}
          </h1>

          {/* Price */}
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {coffee.price_amount && (
              <span className="whitespace-nowrap text-2xl font-bold text-stone-900">
                {coffee.price_amount.toLocaleString('tr-TR')} TL
              </span>
            )}
            {coffee.price_per_100g && (
              <span className="whitespace-nowrap text-sm text-stone-500">
                {coffee.price_per_100g.toLocaleString('tr-TR')} TL/100g
              </span>
            )}
            {coffee.weight_grams && (
              <span className="whitespace-nowrap text-sm text-stone-500">
                {coffee.weight_grams >= 1000
                  ? `${(coffee.weight_grams / 1000).toFixed(coffee.weight_grams % 1000 ? 1 : 0)}kg`
                  : `${coffee.weight_grams}g`}
              </span>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-stone-900">Künye doluluğu</h2>
              <span className="text-sm font-bold text-amber-700">%{completenessScore}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {completenessBadges.map((badge) => (
                <span
                  key={badge.label}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    badge.available
                      ? 'bg-green-100 text-green-800'
                      : 'bg-stone-200 text-stone-500'
                  }`}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          </div>

          {/* Buy button */}
          <div className="mt-6">
            <BuyButton
              coffeeId={coffee.id}
              productUrl={coffee.product_url}
              roasterName={roaster.name}
            />
          </div>

          {/* Specs table */}
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold text-stone-900">Detaylar</h2>
            <dl className="divide-y divide-stone-100">
              {coffee.weight_grams && (
                <SpecRow label="Paket" value={formatWeight(coffee.weight_grams)} />
              )}
              {coffee.price_per_100g && (
                <SpecRow
                  label="100 g fiyatı"
                  value={`${coffee.price_per_100g.toLocaleString('tr-TR')} TL/100 g`}
                />
              )}
              <SpecRow label="Stok" value={coffee.is_available ? 'Stokta görünüyor' : 'Stokta yok'} />
              {coffee.origin_country && (
                <SpecRow label="Köken" value={
                  [coffee.origin_country, coffee.origin_region].filter(Boolean).join(', ')
                } />
              )}
              {coffee.origin_farm && (
                <SpecRow label="Çiftlik" value={coffee.origin_farm} />
              )}
              {coffee.origin_altitude && (
                <SpecRow label="Rakım" value={coffee.origin_altitude} />
              )}
              {coffee.origin_producer && (
                <SpecRow label="Üretici" value={coffee.origin_producer} />
              )}
              {coffee.process !== 'unknown' && (
                <SpecRow
                  label="İşleme"
                  value={
                    coffee.process_detail
                      ? `${PROCESS_LABELS[coffee.process] ?? coffee.process} (${coffee.process_detail})`
                      : PROCESS_LABELS[coffee.process] ?? coffee.process
                  }
                />
              )}
              {coffee.roast_level !== 'unknown' && (
                <SpecRow
                  label="Kavurma"
                  value={ROAST_LABELS[coffee.roast_level] ?? coffee.roast_level}
                />
              )}
              {coffee.variety && (
                <SpecRow label="Varyete" value={coffee.variety} />
              )}
              {coffee.harvest_year && (
                <SpecRow label="Hasat / crop" value={coffee.harvest_year} />
              )}
              {coffee.roast_date && (
                <SpecRow label="Kavrum tarihi" value={coffee.roast_date} />
              )}
              {coffee.sca_score && (
                <SpecRow label="SCA Puanı" value={String(coffee.sca_score)} />
              )}
              {coffee.is_decaf && (
                <SpecRow label="Dekaf" value="Evet" />
              )}
              <SpecRow
                label="Kavurucu"
                value={
                  <Link href={`/roasters/${roaster.slug}`} className="text-amber-700 hover:text-amber-800">
                    {roaster.name}
                  </Link>
                }
              />
              <SpecRow
                label="Kaynak"
                value={
                  <a
                    href={coffee.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-700 hover:text-amber-800"
                  >
                    Kavurucu sayfası
                  </a>
                }
              />
            </dl>
          </div>

          {coffee.brew_methods.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-stone-900">Demleme Uyumu</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {coffee.brew_methods.map((method) => (
                  <Tag key={method} size="sm">
                    {BREW_METHOD_LABELS[method] ?? method}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Flavor notes */}
          {coffee.flavor_notes_normalized.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-stone-900">Tadım Notları</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {coffee.flavor_notes_normalized.map((note) => {
                  const category = coffee.flavor_categories.find((cat) =>
                    note.toLowerCase().includes(cat.toLowerCase())
                  );
                  return (
                    <Tag key={note} category={category} size="sm">
                      {note}
                    </Tag>
                  );
                })}
              </div>
            </div>
          )}

          {brewRecipes.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-stone-900">Kavurucudan Öneri</h2>
              <div className="mt-3 space-y-3">
                {brewRecipes.map((recipe, index) => (
                  <RecipeCard key={`${recipe.method}-${index}`} recipe={recipe} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Similar coffees */}
      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-stone-900">Benzer Kahveler</h2>
          <div className="mt-6">
            <CoffeeGrid coffees={similar} />
          </div>
        </section>
      )}
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-stone-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: CoffeeBrewRecipe }) {
  const fields = [
    recipe.dose_grams ? ['Doz', `${recipe.dose_grams} g`] : null,
    recipe.water_grams ? ['Su', `${recipe.water_grams} g/ml`] : null,
    recipe.yield_grams ? ['Çıktı', `${recipe.yield_grams} g`] : null,
    recipe.ratio ? ['Oran', recipe.ratio] : null,
    recipe.water_temp_c ? ['Su sıcaklığı', recipe.water_temp_c] : null,
    recipe.brew_time ? ['Süre', recipe.brew_time] : null,
    recipe.grind ? ['Öğütüm', recipe.grind] : null,
  ].filter((field): field is [string, string] => Boolean(field));

  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-bold text-stone-900">{recipe.method}</h3>
        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
          Kavurucu sayfasından
        </span>
      </div>
      {fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-stone-500">{label}</dt>
              <dd className="text-sm font-medium text-stone-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {recipe.steps.length > 0 && (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-stone-600">
          {recipe.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </article>
  );
}

function getCompletenessBadges(coffee: Awaited<ReturnType<typeof getCoffeeBySlug>>) {
  if (!coffee) return [];

  return [
    { label: '100g fiyatı var', available: coffee.price_per_100g != null },
    { label: 'Köken var', available: Boolean(coffee.origin_country) },
    { label: 'İşleme var', available: coffee.process !== 'unknown' },
    { label: 'Kavrum var', available: coffee.roast_level !== 'unknown' },
    { label: 'Tadım notu var', available: coffee.flavor_notes_normalized.length > 0 },
    { label: 'Demleme var', available: coffee.brew_methods.length > 0 },
    { label: 'Reçete var', available: (coffee.brew_recipes ?? []).length > 0 },
  ];
}

function formatWeight(weightGrams: number) {
  return weightGrams >= 1000
    ? `${(weightGrams / 1000).toFixed(weightGrams % 1000 ? 1 : 0)} kg`
    : `${weightGrams} g`;
}
