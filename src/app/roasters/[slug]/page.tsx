import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRoasterBySlug } from '@/lib/queries/roasters';
import { getCoffees } from '@/lib/queries/coffees';
import { CoffeeGrid } from '@/components/coffee/coffee-grid';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const roaster = await getRoasterBySlug(slug);
  if (!roaster) return { title: 'Roaster Not Found' };

  return {
    title: roaster.name,
    description: `Specialty coffees from ${roaster.name}, ${roaster.city}. Browse their catalog and buy direct.`,
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-stone-500">
        <Link href="/roasters" className="hover:text-stone-700">
          Roasters
        </Link>
        <span className="mx-2">/</span>
        <span className="text-stone-900">{roaster.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-2xl font-bold text-amber-700">
          {roaster.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">{roaster.name}</h1>
          <p className="text-sm text-stone-500">
            {roaster.city} &middot; {total} coffee{total !== 1 ? 's' : ''}
          </p>
        </div>
        <a
          href={roaster.website_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Visit Website
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>

      {/* Coffees grid */}
      <div className="mt-10">
        <CoffeeGrid coffees={coffees} />
      </div>
    </div>
  );
}
