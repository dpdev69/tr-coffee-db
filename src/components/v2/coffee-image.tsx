import { COFFEE_IMAGE_WIDTHS, coffeeImageUrl, trustedCoffeeImageUrl } from '@/lib/coffee-image';

/** vinext remote fill images bypass its optimizer; this server-rendered srcset uses our Images route. */
/**
 * `roaster` names the coffee on the fallback tile. A missing image, or one on a host the image route will not
 * fetch, gets the same tile here that the route draws for a dead source, never a broken-image icon.
 */
export function CoffeeImage({ source, alt, sizes, className = '', loading = 'lazy', roaster }: { source: string | null | undefined; alt: string; sizes: string; className?: string; loading?: 'lazy' | 'eager'; roaster?: string }) {
  if (!source || !trustedCoffeeImageUrl(source)) return <span role={alt ? 'img' : undefined} aria-label={alt || undefined} className={`${className} flex items-center justify-center bg-tint text-center font-display text-2xl text-muted`}>{roaster}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={coffeeImageUrl(source, 640, roaster)} srcSet={COFFEE_IMAGE_WIDTHS.map(width => `${coffeeImageUrl(source, width, roaster)} ${width}w`).join(', ')} sizes={sizes} alt={alt} loading={loading} decoding="async" className={className} width={1280} height={1280} />;
}
