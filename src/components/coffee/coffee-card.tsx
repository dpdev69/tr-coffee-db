import Image from 'next/image';
import Link from 'next/link';
import { PROCESS_LABELS, ROAST_LABELS } from '@/lib/constants/filter-options';
import {
  formatPackageWeight,
  formatVerifiedAt,
  getUnitPrice,
} from '@/lib/coffee-display';
import type { CoffeeWithRoaster } from '@/lib/types/database';
import { CompareToggle } from './compare-controls';

export function CoffeeCard({
  coffee,
  imageLoading = 'lazy',
}: {
  coffee: CoffeeWithRoaster;
  imageLoading?: 'eager' | 'lazy';
}) {
  const name = coffee.name_normalized ?? coffee.name;
  const unitPrice = getUnitPrice(coffee);
  return (
    <article className="coffee-card">
      <Link href={`/coffees/${coffee.slug}`} className="coffee-card-main">
        <div className="coffee-card-image">
          {coffee.image_url && !/\.gif(?:[?#]|$)/i.test(coffee.image_url) ? (
            <Image
              src={coffee.image_url}
              alt={coffee.name}
              fill
              sizes="(max-width: 639px) 90vw, (max-width: 1023px) 45vw, 28vw"
              loading={imageLoading}
              className="object-contain p-4"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="font-display text-4xl text-[#244b3d]">
                {coffee.roasters.name
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join('')}
              </span>
              <span className="text-xs text-[#625e57]">
                Ürün görseli bulunmuyor
              </span>
            </div>
          )}
          {coffee.is_decaf && (
            <span className="absolute left-3 top-3 rounded bg-[#244b3d] px-2 py-1 text-xs font-semibold text-white">
              Kafeinsiz
            </span>
          )}
        </div>
        <div className="coffee-card-body">
          <p className="text-xs font-semibold text-[#244b3d]">
            {coffee.roasters.name}
          </p>
          <h3 className="line-clamp-2">{name}</h3>
          <p className="mt-2 text-sm text-[#625e57]">
            {coffee.origin_country ?? 'Köken belirtilmemiş'}
            {coffee.process !== 'unknown'
              ? ` · ${PROCESS_LABELS[coffee.process] ?? coffee.process}`
              : ''}
          </p>
          <p className="mt-3 min-h-10 text-sm leading-5 text-[#625e57]">
            {coffee.flavor_notes_normalized.slice(0, 3).join(' · ') ||
              'Tadım notu paylaşılmamış'}
          </p>
          <div className="coffee-card-price">
            <div className="flex flex-wrap items-baseline gap-2">
              <strong className="text-xl tabular-nums">
                {coffee.price_amount && coffee.price_amount > 0
                  ? `${coffee.price_amount.toLocaleString('tr-TR')} ${coffee.price_currency === 'TRY' ? 'TL' : coffee.price_currency}`
                  : 'Fiyat belirtilmemiş'}
              </strong>
              {coffee.weight_grams && coffee.weight_grams > 0 ? (
                <span className="text-sm text-[#625e57]">
                  / {formatPackageWeight(coffee.weight_grams)}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap justify-between gap-1 text-xs text-[#625e57]">
              <span>
                {unitPrice !== null
                  ? `${unitPrice.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} TL / 100 g`
                  : 'Birim fiyat hesaplanamıyor'}
              </span>
              {coffee.roast_level !== 'unknown' && (
                <span>
                  {ROAST_LABELS[coffee.roast_level] ?? coffee.roast_level}{' '}
                  kavrum
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
      <div className="coffee-card-footer">
        <time dateTime={coffee.last_seen_at ?? undefined}>
          {formatVerifiedAt(coffee.last_seen_at)}
        </time>
        <CompareToggle slug={coffee.slug} name={name} />
      </div>
    </article>
  );
}
