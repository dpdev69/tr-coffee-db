import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('UX and compliance surfaces', () => {
  it('announces mobile menu state to assistive technology', () => {
    const source = readSource('src/components/layout/header.tsx');

    assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
    assert.match(source, /aria-controls="mobile-menu"/);
    assert.match(source, /id="mobile-menu"/);
    assert.match(source, /event\.key === 'Escape'/);
  });

  it('keeps mobile filter dialog focus inside the modal', () => {
    const source = readSource('src/components/coffee/sidebar-filters.tsx');

    assert.match(source, /aria-modal="true"/);
    assert.match(source, /mobileDialogRef/);
    assert.match(source, /getFocusableElements/);
    assert.match(source, /event\.key === 'Tab'/);
  });

  it('makes the roaster filter searchable without introducing nested scroll traps', () => {
    const source = readSource('src/components/coffee/sidebar-filters.tsx');

    assert.match(source, /roasterQuery/);
    assert.match(source, /Kavurucu ara/);
    assert.match(source, /visibleRoasters/);
    assert.doesNotMatch(source, /max-h-48/);
    assert.doesNotMatch(source, /<div className="mt-2[^"]*overflow-y-auto/);
  });

  it('uses user-facing filter result copy', () => {
    const source = readSource('src/components/coffee/active-filter-summary.tsx');

    assert.doesNotMatch(source, /test tercih/);
    assert.doesNotMatch(source, /Bilgi eksik/);
  });

  it('uses natural Turkish discovery copy with clear unit-price comparison', () => {
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
    assert.match(surfaces, /100 g/);
    assert.match(surfaces, /4 kısa soruyu/);
    assert.match(surfaces, /Kahve ara/);
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
    assert.match(source, /hasQuizSelections/);
    assert.match(source, /role="progressbar"/);
    assert.match(source, /Tüm kataloğu aç/);
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

  it('uses non-blocking real links for outbound coffee clicks', () => {
    const source = readSource('src/components/coffee/buy-button.tsx');

    assert.match(source, /<a\b/);
    assert.match(source, /navigator\.sendBeacon/);
    assert.match(source, /keepalive: true/);
    assert.doesNotMatch(source, /await fetch\('\/api\/click'/);
    assert.doesNotMatch(source, /window\.open/);
  });

  it('places the coffee detail buy action before the long detail table and exposes report flow', () => {
    const source = readSource('src/app/coffees/[slug]/page.tsx');
    const buyIndex = source.indexOf('<BuyButton');
    const detailsIndex = source.indexOf('>Detaylar</h2>');

    assert.ok(buyIndex > -1, 'Coffee detail must render BuyButton');
    assert.ok(detailsIndex > -1, 'Coffee detail must render details section');
    assert.ok(buyIndex < detailsIndex, 'BuyButton should appear before details');
    assert.match(source, /ReportIssueForm/);
  });

  it('discloses analytics, click tracking, retention, contact, and request paths', () => {
    const source = readSource('src/app/privacy/page.tsx');

    assert.match(source, /Vercel Analytics/);
    assert.match(source, /redirect_events|tıklama/);
    assert.match(source, /saklama|retention|30 gün|90 gün/i);
    assert.match(source, /GitHub Issues|iletişim/i);
    assert.match(source, /erişim|düzeltme|silme/i);
  });

  it('adds a data correction intake endpoint and coffee detail UI', () => {
    const api = readSource('src/app/api/correction-report/route.ts');
    const component = readSource('src/components/coffee/report-issue-form.tsx');

    assert.match(api, /correction_reports/);
    assert.match(api, /applyPublicCoffeeVisibility/);
    assert.match(component, /Bilgilerde sorun var/);
    assert.match(component, /issue_type/);
  });
});

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
