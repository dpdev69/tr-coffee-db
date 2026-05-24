import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('UX and compliance surfaces', () => {
  it('announces mobile menu state to assistive technology', () => {
    const source = readSource('src/components/layout/header.tsx');

    assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
    assert.match(source, /aria-controls="mobile-menu"/);
    assert.match(source, /id="mobile-menu"/);
  });

  it('uses user-facing filter result copy', () => {
    const source = readSource('src/components/coffee/active-filter-summary.tsx');

    assert.doesNotMatch(source, /test tercih/);
    assert.doesNotMatch(source, /Bilgi eksik/);
  });

  it('uses natural Turkish discovery copy without 100 g comparison messaging', () => {
    const surfaces = [
      'src/app/page.tsx',
      'src/app/coffees/page.tsx',
      'src/app/quiz/page.tsx',
      'src/components/layout/header.tsx',
      'src/components/layout/footer.tsx',
      'src/lib/quiz-filters.ts',
    ].map(readSource).join('\n');

    assert.doesNotMatch(surfaces, /Adil Karşılaştır/);
    assert.doesNotMatch(surfaces, /Tercihime Göre/);
    assert.doesNotMatch(surfaces, /fiyat filtresi|bütçe|5 kısa/i);
    assert.doesNotMatch(surfaces, /100 g|100g|TL\/100/i);
    assert.match(surfaces, /4 kısa soruyu/);
    assert.match(surfaces, /Yeni kahveni kolayca bul/);
  });

  it('keeps database filter metadata explicit without exposing 100 g price ranges', () => {
    const migration = readSource('supabase/migrations/019_metadata_filter_and_raw_price_contract.sql');
    const databaseTypes = readSource('src/lib/types/database.ts');

    assert.match(migration, /process = 'unknown'/);
    assert.match(migration, /roast_level = 'unknown'/);
    assert.match(migration, /ALTER COLUMN process SET NOT NULL/);
    assert.match(migration, /ALTER COLUMN roast_level SET NOT NULL/);
    assert.match(migration, /process <> 'unknown'/);
    assert.match(migration, /roast_level <> 'unknown'/);
    assert.match(migration, /\bis_public\s*=\s*true\b/);
    assert.match(migration, /\bspecialty_status\s*=\s*'specialty'/);
    assert.match(migration, /%origami%/);
    assert.match(migration, /%sample box%/);
    assert.match(migration, /%aşırı kolay cold brew%/);
    assert.doesNotMatch(migration, /price_range|price_per_100g/);
    assert.doesNotMatch(databaseTypes, /price_range/);
  });

  it('does not expose missing metadata as a public filter option', () => {
    const surfaces = [
      'src/components/coffee/sidebar-filters.tsx',
      'src/components/coffee/active-filter-summary.tsx',
      'src/lib/coffee-filters.ts',
      'src/lib/constants/filter-options.ts',
    ].map(readSource).join('\n');

    assert.doesNotMatch(surfaces, /Bilgi eksik|Belirtilmemiş/);
    assert.match(surfaces, /value !== 'unknown'/);
  });

  it('does not introduce cart, checkout, or in-app payment affordances', () => {
    const surfaces = [
      'src/app/page.tsx',
      'src/components/layout/header.tsx',
      'src/components/layout/footer.tsx',
    ].map(readSource).join('\n');

    assert.doesNotMatch(surfaces, /sepet|checkout|cart|ödeme/i);
  });

  it('keeps filter groups from creating nested scroll traps', () => {
    const source = readSource('src/components/coffee/sidebar-filters.tsx');

    assert.doesNotMatch(source, /max-h-48/);
    assert.doesNotMatch(source, /<div className="mt-2[^"]*overflow-y-auto/);
  });

  it('keeps quiz step changes oriented at the current question', () => {
    const source = readSource('src/components/quiz/quiz-container.tsx');

    assert.match(source, /scrollIntoView/);
    assert.match(source, /questionRef/);
  });

  it('exposes privacy and terms routes in navigation and sitemap', () => {
    const footer = readSource('src/components/layout/footer.tsx');
    const sitemap = readSource('src/app/sitemap.ts');

    assert.match(footer, /href="\/privacy"/);
    assert.match(footer, /href="\/terms"/);
    assert.match(sitemap, /absoluteUrl\('\/privacy'\)/);
    assert.match(sitemap, /absoluteUrl\('\/terms'\)/);
  });

  it('guards roaster external links with the shared trusted URL policy', () => {
    const source = readSource('src/app/roasters/[slug]/page.tsx');

    assert.match(source, /normalizeTrustedHttpUrl/);
    assert.match(source, /safeWebsiteUrl/);
    assert.doesNotMatch(source, /href=\{roaster\.website_url\}/);
  });
});

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
