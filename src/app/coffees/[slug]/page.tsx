import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, unstable_rethrow } from 'next/navigation';
import { getCoffeeBySlug, getSimilarCoffees } from '@/lib/queries/coffees';
import { BuyButton } from '@/components/coffee/buy-button';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { Tag } from '@/components/ui/tag';
import { DataSourceNotice } from '@/components/ui/data-source-notice';
import { BREW_METHOD_LABELS, PROCESS_LABELS, ROAST_LABELS } from '@/lib/constants/filter-options';
import { formatPackageWeight, formatVerifiedAt, getSourceHost } from '@/lib/coffee-display';
import { SITE_NAME } from '@/lib/site';
import { collectTrustedHosts } from '@/lib/trusted-url';
import type { CoffeeBrewRecipe } from '@/lib/types/database';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let coffee: Awaited<ReturnType<typeof getCoffeeBySlug>>;

  try {
    coffee = await getCoffeeBySlug(slug);
  } catch (error) {
    unstable_rethrow(error);
    console.error('Coffee metadata failed to load', {
      error: getErrorMessage(error),
      slug,
    });
    return {
      title: 'Kahve Detayları Geçici Olarak Yüklenemiyor',
      description: 'Bu kahvenin güncel detaylarını şu an doğrulayamıyoruz.',
    };
  }

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
  let coffee: Awaited<ReturnType<typeof getCoffeeBySlug>>;

  try {
    coffee = await getCoffeeBySlug(slug);
  } catch (error) {
    unstable_rethrow(error);
    console.error('Coffee detail failed to load', {
      error: getErrorMessage(error),
      slug,
    });
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <DataSourceNotice
          title="Kahve detayı geçici olarak yüklenemiyor."
          message="Veri kaynağına şu an ulaşamadık. Bu kahvenin olmadığı anlamına gelmez; güncel detayları doğrulayamıyoruz."
          actionHref="/coffees"
          actionLabel="Kahve kataloğuna dön"
        />
      </div>
    );
  }

  if (!coffee) notFound();

  let similar: Awaited<ReturnType<typeof getSimilarCoffees>> = [];
  try {
    similar = await getSimilarCoffees(coffee, 4);
  } catch (error) {
    unstable_rethrow(error);
    console.error('Similar coffees failed to load', {
      coffee_id: coffee.id,
      error: getErrorMessage(error),
      slug,
    });
  }
  const roaster = coffee.roasters as {
    id: string;
    name: string;
    slug: string;
    city: string;
    website_url: string;
    shop_url: string;
    logo_url: string | null;
  };
  const brewRecipes = coffee.brew_recipes ?? [];
  const sourceHost = getSourceHost(coffee.product_url);
  const verifiedAt = formatVerifiedAt(coffee.last_seen_at);
  const productUrlHosts = collectTrustedHosts([roaster.website_url, roaster.shop_url]);

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
        <CoffeeImage
          alt={coffee.name}
          imageUrl={coffee.image_url}
          sizes="50vw"
          className="hidden aspect-square rounded-2xl lg:block"
          priority
        />

        {/* Details */}
        <div>
          <Link
            href={`/roasters/${roaster.slug}`}
            className="text-sm font-medium text-amber-700 hover:text-amber-800"
          >
            {roaster.name} &middot; {roaster.city}
          </Link>

          <h1 className="mt-2 text-2xl font-bold text-stone-900 sm:text-3xl">
            {coffee.name_normalized ?? coffee.name}
          </h1>

          {/* Price */}
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {coffee.price_amount && (
              <span className="whitespace-nowrap text-2xl font-bold text-stone-900">
                {coffee.price_amount.toLocaleString('tr-TR')} TL
              </span>
            )}
            {coffee.weight_grams && (
              <span className="whitespace-nowrap text-sm text-stone-500">
                {formatPackageWeight(coffee.weight_grams)}
              </span>
            )}
            {coffee.price_per_100g && (
              <span className="whitespace-nowrap text-sm text-stone-500">
                ({coffee.price_per_100g.toLocaleString('tr-TR')} TL / 100 g)
              </span>
            )}
          </div>

          <CoffeeImage
            alt={coffee.name}
            imageUrl={coffee.image_url}
            sizes="(max-width: 1023px) calc(100vw - 2rem), 1px"
            className="mt-6 aspect-[16/10] rounded-xl lg:hidden"
            priority
          />

          {/* Specs table */}
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-semibold text-stone-900">Detaylar</h2>
            <dl className="divide-y divide-stone-100">
              {coffee.weight_grams && (
                <SpecRow label="Paket" value={formatPackageWeight(coffee.weight_grams)} />
              )}
              {coffee.price_per_100g && (
                <SpecRow
                  label="100 g fiyatı"
                  value={`${coffee.price_per_100g.toLocaleString('tr-TR')} TL/100 g`}
                />
              )}
              <SpecRow label="Stok" value={coffee.is_available ? 'Stokta görünüyor' : 'Stokta yok'} />
              <SpecRow label="Doğrulama" value={verifiedAt} />
              {sourceHost && (
                <SpecRow label="Kaynak" value={sourceHost} />
              )}
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
              {coffee.flavor_notes_normalized.length > 0 && (
                <SpecRow
                  label="Tadım notları"
                  value={
                    <div className="flex flex-wrap justify-end gap-2">
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
                  }
                />
              )}
              {coffee.brew_methods.length > 0 && (
                <SpecRow
                  label="Demleme uyumu"
                  value={
                    <div className="flex flex-wrap justify-end gap-2">
                      {coffee.brew_methods.map((method) => (
                        <Tag key={method} size="sm">
                          {BREW_METHOD_LABELS[method] ?? method}
                        </Tag>
                      ))}
                    </div>
                  }
                />
              )}
            </dl>
          </div>

          {/* Buy button */}
          <div className="mt-6">
            <BuyButton
              allowedHosts={productUrlHosts}
              coffeeId={coffee.id}
              productUrl={coffee.product_url}
              roasterName={roaster.name}
            />
          </div>

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function SpecRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-stone-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-stone-900">{value}</dd>
    </div>
  );
}

function CoffeeImage({
  alt,
  className,
  imageUrl,
  priority = false,
  sizes,
}: {
  alt: string;
  className: string;
  imageUrl: string | null;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-stone-100 ${className}`}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          loading={priority ? 'eager' : 'lazy'}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center bg-amber-50 px-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-amber-200 bg-white text-2xl font-bold text-amber-800 shadow-sm">
            {getImageInitials(alt)}
          </div>
          <span className="mt-4 text-sm font-medium text-stone-500">Görsel bekleniyor</span>
        </div>
      )}
    </div>
  );
}

function getImageInitials(label: string) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('tr-TR');

  return initials || 'DB';
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
