import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRoasterBySlug } from '@/lib/queries/roasters';
import { getCoffees } from '@/lib/queries/coffees';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';
import { RoasterAvatar } from '@/components/roaster/roaster-avatar';
import { SITE_NAME } from '@/lib/site';
import { normalizeTrustedHttpUrl } from '@/lib/trusted-url';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const roaster = await getRoasterBySlug(slug);
  if (!roaster) return { title: 'Kavurucu Bulunamadı' };
  const roasterLocation = roaster.city ? `${roaster.name}, ${roaster.city}` : roaster.name;
  const description = `${roasterLocation} kavurucusunun güncel nitelikli kahvelerini inceleyin; fiyat, köken ve tadım bilgileriyle seçim yapın.`;

  return {
    title: roaster.name,
    description,
    alternates: {
      canonical: `/roasters/${slug}`,
    },
    openGraph: {
      title: `${roaster.name} | ${SITE_NAME}`,
      description,
      url: `/roasters/${slug}`,
      siteName: SITE_NAME,
      images: roaster.logo_url ? [roaster.logo_url] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${roaster.name} | ${SITE_NAME}`,
      description,
      images: roaster.logo_url ? [roaster.logo_url] : [],
    },
  };
}

export default async function RoasterDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const roaster = await getRoasterBySlug(slug);
  if (!roaster) notFound();

  const { coffees, total } = await getCoffees({
    roaster: [slug],
    perPage: 50,
  });
  const safeWebsiteUrl = normalizeTrustedHttpUrl(roaster.website_url);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <nav className="mb-6 text-sm text-[#5d5853]">
        <Link href="/roasters" className="hover:text-[#1f1d1b]">
          Kavurucular
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#1f1d1b]">{roaster.name}</span>
      </nav>

      <div className="flex flex-col gap-5 rounded-[24px] border border-[#1f1d1b]/10 bg-white p-5 sm:flex-row sm:items-center">
        <RoasterAvatar name={roaster.name} logoUrl={roaster.logo_url} size="lg" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#244b3d]">
            Kavurucu
          </p>
          <h1 className="mt-1 font-display text-4xl leading-none text-[#1f1d1b]">{roaster.name}</h1>
          <p className="mt-2 text-sm text-[#5d5853]">
            {roaster.city} &middot; {total} kahve
          </p>
        </div>
        {safeWebsiteUrl ? (
          <a
            href={safeWebsiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-[#1f1d1b] px-4 text-sm font-semibold text-[#1f1d1b] hover:bg-[#f6f1e8] sm:ml-auto"
          >
            Siteye Git
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        ) : (
          <span className="rounded-lg border border-[#1f1d1b]/10 px-4 py-2 text-sm font-medium text-[#5d5853] sm:ml-auto">
            Site bağlantısı doğrulanamadı
          </span>
        )}
      </div>

      <div className="mt-10">
        <CoffeeGrid coffees={coffees} />
      </div>
    </div>
  );
}
