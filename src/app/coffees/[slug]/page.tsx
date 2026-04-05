import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCoffeeBySlug, getSimilarCoffees } from '@/lib/queries/coffees';
import { BuyButton } from '@/components/coffee/buy-button';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { Tag } from '@/components/ui/tag';
import { PROCESS_LABELS, ROAST_LABELS } from '@/lib/constants/filter-options';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const coffee = await getCoffeeBySlug(slug);
  if (!coffee) return { title: 'Coffee Not Found' };

  const title = coffee.name_normalized ?? coffee.name;
  const roaster = coffee.roasters.name;

  return {
    title: `${title} by ${roaster}`,
    description: `${title} — ${coffee.origin_country ?? 'Specialty'} coffee by ${roaster}. ${
      coffee.process !== 'unknown' ? PROCESS_LABELS[coffee.process] + ' process. ' : ''
    }${coffee.price_amount ? coffee.price_amount + ' TL.' : ''}`,
    openGraph: {
      title: `${title} | ${roaster}`,
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/coffees" className="hover:text-stone-700">
          Coffees
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
          <div className="mt-4 flex items-baseline gap-3">
            {coffee.price_amount && (
              <span className="text-2xl font-bold text-stone-900">
                {coffee.price_amount.toLocaleString('tr-TR')} TL
              </span>
            )}
            {coffee.price_per_100g && (
              <span className="text-sm text-stone-500">
                {coffee.price_per_100g.toLocaleString('tr-TR')} TL/100g
              </span>
            )}
            {coffee.weight_grams && (
              <span className="text-sm text-stone-500">
                {coffee.weight_grams >= 1000
                  ? `${(coffee.weight_grams / 1000).toFixed(coffee.weight_grams % 1000 ? 1 : 0)}kg`
                  : `${coffee.weight_grams}g`}
              </span>
            )}
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
            <h2 className="text-lg font-semibold text-stone-900">Details</h2>
            <dl className="divide-y divide-stone-100">
              {coffee.origin_country && (
                <SpecRow label="Origin" value={
                  [coffee.origin_country, coffee.origin_region].filter(Boolean).join(', ')
                } />
              )}
              {coffee.origin_farm && (
                <SpecRow label="Farm" value={coffee.origin_farm} />
              )}
              {coffee.origin_altitude && (
                <SpecRow label="Altitude" value={coffee.origin_altitude} />
              )}
              {coffee.process !== 'unknown' && (
                <SpecRow
                  label="Process"
                  value={PROCESS_LABELS[coffee.process] ?? coffee.process}
                />
              )}
              {coffee.roast_level !== 'unknown' && (
                <SpecRow
                  label="Roast"
                  value={ROAST_LABELS[coffee.roast_level] ?? coffee.roast_level}
                />
              )}
              {coffee.variety && (
                <SpecRow label="Variety" value={coffee.variety} />
              )}
              {coffee.sca_score && (
                <SpecRow label="SCA Score" value={String(coffee.sca_score)} />
              )}
              {coffee.is_decaf && (
                <SpecRow label="Decaf" value="Yes" />
              )}
            </dl>
          </div>

          {/* Flavor notes */}
          {coffee.flavor_notes_normalized.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-stone-900">Tasting Notes</h2>
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
        </div>
      </div>

      {/* Similar coffees */}
      {similar.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold text-stone-900">Similar Coffees</h2>
          <div className="mt-6">
            <CoffeeGrid coffees={similar} />
          </div>
        </section>
      )}
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className="text-sm font-medium text-stone-900">{value}</dd>
    </div>
  );
}
