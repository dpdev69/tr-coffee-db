import { COFFEE_IMAGE_WIDTHS, coffeeImageUrl } from '@/lib/coffee-image';

/** vinext remote fill images bypass its optimizer; this server-rendered srcset uses our Images route. */
/** `roaster` names the coffee on the fallback tile the image route draws when the source image is dead. */
export function CoffeeImage({ source, alt, sizes, className, loading = 'lazy', roaster }: { source: string; alt: string; sizes: string; className?: string; loading?: 'lazy' | 'eager'; roaster?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={coffeeImageUrl(source, 640, roaster)} srcSet={COFFEE_IMAGE_WIDTHS.map(width => `${coffeeImageUrl(source, width, roaster)} ${width}w`).join(', ')} sizes={sizes} alt={alt} loading={loading} decoding="async" className={className} width={1280} height={1280} />;
}
