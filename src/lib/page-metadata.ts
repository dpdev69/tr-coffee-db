import type { Metadata } from 'next';
import { brand } from './brand';

/** Keep search and social previews specific to the page being shared. */
export function pageMetadata(title: string, description: string, path: string): Metadata {
  const socialTitle = `${title} | ${brand.name}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title: socialTitle, description, url: path, siteName: brand.name, locale: 'tr_TR', type: 'website' },
    twitter: { card: 'summary_large_image', title: socialTitle, description },
  };
}
