import Image from 'next/image';
import Link from 'next/link';
import { Tag } from '@/components/ui/tag';
import { PROCESS_LABELS, ROAST_LABELS } from '@/lib/constants/filter-options';
import { formatPackageWeight, formatVerifiedAt, getSourceHost } from '@/lib/coffee-display';
import type { CoffeeWithRoaster } from '@/lib/types/database';

export function CoffeeCard({
  coffee,
  imageLoading = 'lazy',
}: {
  coffee: CoffeeWithRoaster;
  imageLoading?: 'eager' | 'lazy';
}) {
  const priceDisplay = coffee.price_amount
    ? `${coffee.price_amount.toLocaleString('tr-TR')} TL`
    : null;

  const pricePer100g = coffee.price_per_100g
    ? `${coffee.price_per_100g.toLocaleString('tr-TR')} TL/100g`
    : null;
  const sourceHost = getSourceHost(coffee.product_url);
  const verifiedAt = formatVerifiedAt(coffee.last_seen_at);

  return (
    <Link
      href={`/coffees/${coffee.slug}`}
      className="group overflow-hidden rounded-xl border border-stone-200 bg-white transition-shadow hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-stone-100">
        {coffee.image_url ? (
          <Image
            src={coffee.image_url}
            alt={coffee.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading={imageLoading}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <CoffeeImagePlaceholder label={coffee.roasters.name} />
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {coffee.process !== 'unknown' && (
            <span className="rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-stone-800 shadow-sm backdrop-blur-sm">
              {PROCESS_LABELS[coffee.process] ?? coffee.process}
            </span>
          )}
          {coffee.roast_level !== 'unknown' && (
            <span className="rounded-md bg-amber-100/90 px-2 py-0.5 text-[11px] font-semibold text-amber-800 shadow-sm backdrop-blur-sm">
              {ROAST_LABELS[coffee.roast_level] ?? coffee.roast_level}
            </span>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="p-4">
        <p className="text-xs font-medium text-amber-700">
          {coffee.roasters.name}
        </p>
        <h3 className="mt-1 font-semibold leading-tight text-stone-900 line-clamp-2">
          {coffee.name_normalized ?? coffee.name}
        </h3>

        {/* Origin */}
        {coffee.origin_country && (
          <p className="mt-1 text-xs text-stone-500">
            {coffee.origin_region
              ? `${coffee.origin_region}, ${coffee.origin_country}`
              : coffee.origin_country}
          </p>
        )}

        {/* Flavor tags */}
        {coffee.flavor_notes_normalized.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {coffee.flavor_notes_normalized.slice(0, 3).map((note) => (
              <Tag key={note} size="xs">
                {note}
              </Tag>
            ))}
            {coffee.flavor_notes_normalized.length > 3 && (
              <Tag size="xs">+{coffee.flavor_notes_normalized.length - 3}</Tag>
            )}
          </div>
        )}

        {/* Price */}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {priceDisplay && (
            <span className="whitespace-nowrap text-lg font-bold text-stone-900">
              {priceDisplay}
            </span>
          )}
          {pricePer100g && (
            <span className="whitespace-nowrap text-xs text-stone-400">{pricePer100g}</span>
          )}
          {coffee.weight_grams && (
            <span className="whitespace-nowrap text-xs text-stone-400">
              {formatPackageWeight(coffee.weight_grams)}
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-[11px] text-stone-400">
          {sourceHost ? `${verifiedAt} · ${sourceHost}` : verifiedAt}
        </p>
      </div>
    </Link>
  );
}

function CoffeeImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-amber-50 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-200 bg-white text-lg font-bold text-amber-800 shadow-sm">
        {getInitials(label)}
      </div>
      <span className="mt-3 text-xs font-medium text-stone-500">Görsel bekleniyor</span>
    </div>
  );
}

function getInitials(label: string) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('tr-TR');

  return initials || 'DB';
}
