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

  const sourceHost = getSourceHost(coffee.product_url);
  const verifiedAt = formatVerifiedAt(coffee.last_seen_at);

  return (
    <Link
      href={`/coffees/${coffee.slug}`}
      className="group overflow-hidden rounded-[22px] border border-[#1f1d1b]/10 bg-white transition-colors hover:border-[#1f1d1b]/25"
    >
      <div className="relative m-3 aspect-square overflow-hidden rounded-[18px] bg-[#f2eadf]">
        {coffee.image_url ? (
          <Image
            src={coffee.image_url}
            alt={coffee.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            loading={imageLoading}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <CoffeeImagePlaceholder label={coffee.roasters.name} />
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {coffee.process !== 'unknown' && (
            <span className="rounded-md bg-white/95 px-2 py-1 text-[11px] font-semibold text-[#1f1d1b] shadow-sm backdrop-blur-sm">
              {PROCESS_LABELS[coffee.process] ?? coffee.process}
            </span>
          )}
          {coffee.roast_level !== 'unknown' && (
            <span className="rounded-md bg-[#ecff64]/95 px-2 py-1 text-[11px] font-semibold text-[#1f1d1b] shadow-sm backdrop-blur-sm">
              {ROAST_LABELS[coffee.roast_level] ?? coffee.roast_level}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 pt-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7c3a20]">
          {coffee.roasters.name}
        </p>
        <h3 className="mt-2 font-display text-2xl leading-none text-[#1f1d1b] line-clamp-2">
          {coffee.name_normalized ?? coffee.name}
        </h3>

        {coffee.origin_country && (
          <p className="mt-2 text-xs text-[#5d5853]">
            {coffee.origin_region
              ? `${coffee.origin_region}, ${coffee.origin_country}`
              : coffee.origin_country}
          </p>
        )}

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

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {priceDisplay && (
            <span className="whitespace-nowrap text-lg font-bold text-[#1f1d1b]">
              {priceDisplay}
            </span>
          )}
          {coffee.weight_grams && (
            <span className="whitespace-nowrap text-xs text-[#5d5853]">
              {formatPackageWeight(coffee.weight_grams)}
            </span>
          )}
        </div>
        <p className="mt-2 truncate text-[11px] text-[#5d5853]/70">
          {sourceHost ? `${verifiedAt} · ${sourceHost}` : verifiedAt}
        </p>
      </div>
    </Link>
  );
}

function CoffeeImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#f2eadf] px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#1f1d1b]/15 bg-white text-lg font-bold text-[#1f1d1b] shadow-sm">
        {getInitials(label)}
      </div>
      <span className="mt-3 text-xs font-medium text-[#5d5853]">Görsel bekleniyor</span>
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
