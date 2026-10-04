import { COFFEE_IMAGE_WIDTHS, coffeeImageUrl } from '@/lib/coffee-image';

/** vinext remote fill images bypass its optimizer; this server-rendered srcset uses our Images route. */
export function CoffeeImage({ source, alt, sizes, className, loading = 'lazy' }: { source: string; alt: string; sizes: string; className?: string; loading?: 'lazy' | 'eager' }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={coffeeImageUrl(source, 640)} srcSet={COFFEE_IMAGE_WIDTHS.map(width => `${coffeeImageUrl(source, width)} ${width}w`).join(', ')} sizes={sizes} alt={alt} loading={loading} decoding="async" className={className} width={1280} height={1280} />;
}
