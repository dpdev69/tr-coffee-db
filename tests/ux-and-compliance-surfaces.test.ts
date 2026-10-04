import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { POST as retiredCorrection } from '../src/app/api/correction-report/route';

describe('UX and compliance surfaces', () => {
  it('announces mobile menu state to assistive technology', () => {
    const source = readSource('src/components/layout/header.tsx');

    assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
    assert.match(source, /aria-controls="mobile-menu"/);
    assert.match(source, /<dialog\s+id="mobile-menu"/);
    // A modal dialog gives focus containment, Escape-to-close and an inert page natively.
    assert.match(source, /\.showModal\(\)/);
  });

  it('uses natural Turkish discovery copy with roaster package prices', () => {
    const surfaces = [
      'src/app/page.tsx',
      'src/components/v2/discovery-catalog.tsx',
      'src/components/v2/discovery-card.tsx',
      'src/app/quiz/page.tsx',
      'src/components/layout/header.tsx',
      'src/components/layout/footer.tsx',
      'src/lib/quiz-filters.ts',
    ].map(readSource).join('\n');

    assert.doesNotMatch(surfaces, /Adil Karşılaştır/);
    assert.doesNotMatch(surfaces, /Tercihime Göre/);
    assert.doesNotMatch(surfaces, /fiyat filtresi|bütçe|5 kısa/i);
    assert.doesNotMatch(surfaces, /100 g fiyatı|\/ 100 g/);
    assert.match(surfaces, /4 kısa soruyu/);
    assert.match(surfaces, /Kahve veya kavurucu ara/);
  });

  it('keeps catalog maintenance timestamps off public utility surfaces', () => {
    const surfaces = [
      'src/components/coffee/compare-controls.tsx',
      'src/app/compare/page.tsx',
      'src/app/guide/page.tsx',
      'src/app/kavurucu/[slug]/page.tsx',
      'src/app/kavurucular/page.tsx',
    ].map(readSource).join('\n');
    assert.doesNotMatch(surfaces, /formatVerifiedAt|last_seen_at|lastSeenAt|lastSuccessAt|firstSeenAt|Kontrol tarihi|Kaynak kontrolü/);
    assert.doesNotMatch(surfaces, /100 g fiyatı|\/ 100 g|Birim fiyat/);
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

  it('does not introduce cart, checkout, or in-app payment affordances', () => {
    const surfaces = [
      'src/app/page.tsx',
      'src/components/layout/header.tsx',
      'src/components/layout/footer.tsx',
    ].map(readSource).join('\n');

    assert.doesNotMatch(surfaces, /sepet|checkout|cart|ödeme/i);
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
    assert.match(sitemap, /['"]\/privacy['"]/);
    assert.match(sitemap, /['"]\/terms['"]/);
    assert.match(sitemap, /url:absoluteUrl\(path\)/);
  });

  it('keeps migrated roaster navigation internal instead of exposing unchecked website fields', () => {
    const oldRoute = readSource('src/app/roasters/[slug]/page.tsx');
    const source = readSource('src/app/kavurucu/[slug]/page.tsx');
    assert.match(oldRoute, /permanentRedirect\(`\/kavurucu\//);
    assert.match(source, /href="\/kavurucular"/);
    assert.match(source, /href=\{`\/kahveler\?roaster=/);
    assert.doesNotMatch(source, /href=\{roaster\.(?:website_url|websiteUrl|shop_url)\}/);
  });

  it('uses real validated offer links without requiring a browser analytics request first', () => {
    const source = [readSource('src/components/v2/discovery-card.tsx'), readSource('src/components/v2/discovery-detail.tsx')].join('\n');
    assert.match(source, /<a href=\{`\/go\/\$\{offer.id\}/);
    assert.match(source, /offer(?:\?)?\.purchaseUrl\?/);
    assert.doesNotMatch(source, /window\.open|await fetch|navigator\.sendBeacon|onClick=/);
  });

  it('places actual package purchase choices before expert details and omits the retired correction form', () => {
    const source = readSource('src/components/v2/discovery-detail.tsx');
    const buyIndex = source.indexOf('coffee.offers.slice(0,6).map(renderOffer)');
    const detailsIndex = source.indexOf('Çekirdeği tanı.');
    assert.ok(buyIndex > -1, 'Coffee detail must render real package choices');
    assert.ok(detailsIndex > -1 && buyIndex < detailsIndex, 'Package choices precede expert details');
    assert.doesNotMatch(source, /ReportIssueForm|correction-report/);
  });

  it('discloses analytics, click tracking, retention, contact, and request paths', () => {
    const source = readSource('src/app/privacy/page.tsx');

    assert.match(source, /Kit/);
    assert.match(source, /Cloudflare Web Analytics/);
    assert.match(source, /Cloudflare Workers Analytics Engine/);
    assert.match(source, /yerel depolamasında/);
    assert.match(source, /e-posta, IP adresi, kullanıcı kimliği/);
    assert.doesNotMatch(source, /Vercel Analytics|redirect_events|correction_reports/);
    assert.match(source, /saklama|retention|30 gün|90 gün/i);
    assert.match(source, /iletişim/i);
    assert.match(source, /Veri sorumlusu/);
    assert.match(source, /KVKK’nın 11\. maddesi/);
    assert.match(source, /Yurt dışına aktarım/);
    assert.doesNotMatch(source, /github\.com\/dpdev69/, 'private repo issues are not a public contact channel');
    assert.match(source, /abonelikten ayrılma|abonelikten çıkma/);
    assert.match(source, /site verilerini silerek/);
  });

  it('retires correction intake without writing to the rollback database', async () => {
    const api = readSource('src/app/api/correction-report/route.ts');
    const detail = readSource('src/components/v2/discovery-detail.tsx');
    const response = await retiredCorrection();
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.doesNotMatch(api, /import[^;]*supabase|createClient|\.insert\(|\.rpc\(/);
    assert.doesNotMatch(detail, /ReportIssueForm|correction-report/);
  });

});

function readSource(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}
