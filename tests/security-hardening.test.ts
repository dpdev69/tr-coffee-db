import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getCoffeeDetail } from '../shared/v2/catalog';
import type { CatalogDatabase } from '../shared/v2/database';
import { DiscoveryDetail } from '../src/components/v2/discovery-detail';

import {
  collectTrustedHosts,
  normalizeTrustedHttpUrl,
} from '../shared/trusted-url.ts';

describe('trusted URL policy', () => {
  it('allows only http(s) URLs on trusted hosts without embedded credentials', () => {
    const allowedHosts = collectTrustedHosts([
      'https://example.test/shop',
      'https://shop.example.test',
    ]);

    assert.equal(
      normalizeTrustedHttpUrl('/coffee', {
        allowedHosts,
        baseUrl: 'https://example.test/catalog',
      }),
      'https://example.test/coffee'
    );
    assert.equal(
      normalizeTrustedHttpUrl('https://shop.example.test/coffee', { allowedHosts }),
      'https://shop.example.test/coffee'
    );

    assert.equal(
      normalizeTrustedHttpUrl('javascript:alert(1)', {
        allowedHosts,
        baseUrl: 'https://example.test/catalog',
      }),
      null
    );
    assert.equal(
      normalizeTrustedHttpUrl('data:text/html,pwned', {
        allowedHosts,
        baseUrl: 'https://example.test/catalog',
      }),
      null
    );
    assert.equal(
      normalizeTrustedHttpUrl('//evil.example/coffee', {
        allowedHosts,
        baseUrl: 'https://example.test/catalog',
      }),
      null
    );
    assert.equal(
      normalizeTrustedHttpUrl('https://user:pass@example.test/coffee', { allowedHosts }),
      null
    );
  });
});

describe('security hardening guardrails', () => {
  it('refuses to boot production without its own site URL; staging keeps its fallback', () => {
    const load = (env: Record<string, string>) => spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      "const { brand } = await import('./src/lib/brand.ts'); console.log(brand.domain, brand.production);"], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf8' });
    const missing = load({ DEPLOYMENT_STAGE: 'production' });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /NEXT_PUBLIC_SITE_URL is required/);
    assert.equal(load({ DEPLOYMENT_STAGE: 'production', NEXT_PUBLIC_SITE_URL: 'https://kahve.example' }).stdout.trim(), 'https://kahve.example true');
    assert.equal(load({ DEPLOYMENT_STAGE: 'staging' }).stdout.trim(), 'https://coffeedb-v2-web-staging.hellobasalt.workers.dev false');
  });

  it('keeps public URL database constraints in the latest migration', () => {
    const migration = readFileSync('supabase/migrations/017_constrain_public_urls.sql', 'utf8');

    assert.match(migration, /coffees_product_url_http_check/);
    assert.match(migration, /coffees_image_url_http_check/);
    assert.match(migration, /\^https\?\:\/\/\[\^\/\?\#\[:space:\]@\]\+/);
    assert.match(migration, /\[\^\/\?\#\]\*@/);
  });

  it('keeps migration TLS verification enabled', () => {
    const migrationRunner = readFileSync('scrapers/run-migrations.mjs', 'utf8');

    assert.doesNotMatch(migrationRunner, /rejectUnauthorized:\s*false/);
    assert.match(migrationRunner, /rejectUnauthorized:\s*true/);
    assert.match(migrationRunner, /validateSupabaseDbHost/);
    assert.match(migrationRunner, /\.pooler\.supabase\.com/);
  });

  it('keeps the browser sink guarded by the trusted URL policy', () => {
    const buyButton = readFileSync('src/components/coffee/buy-button.tsx', 'utf8');
    const detailPage = readFileSync('src/components/v2/discovery-detail.tsx', 'utf8');
    const card = readFileSync('src/components/v2/discovery-card.tsx', 'utf8');

    assert.match(buyButton, /normalizeTrustedHttpUrl/);
    assert.match(buyButton, /isTrustedHttpUrl/);
    assert.doesNotMatch(detailPage, /href=\{coffee.sourceUrl\}/);
    assert.doesNotMatch(detailPage, /href=\{coffee.canonicalUrl\}/);
    assert.match(detailPage, /href=\{`\/go\/\$\{offer.id\}/);
    assert.match(card, /href=\{`\/go\/\$\{offer.id\}/);
    assert.doesNotMatch(detailPage + card, /href=\{offer(?:\?)?\.purchaseUrl\}/);
  });

  it('omits imported source anchors while retaining canonical identity and validated source data', async () => {
    for (const [url, allowed] of [['https://shop.test/coffee', true], ['https://evil.test/coffee', false], ['javascript:alert(1)', false], ['https://user:pass@shop.test/coffee', false]] as const) {
      const row = { id: 'coffee', roaster_id: 'roaster', name: 'Coffee', slug: 'coffee', source_product_id: 'source', canonical_url: url,
        raw_metadata_json: '{}', first_seen_at: '2026-09-14T00:00:00Z', last_seen_at: '2026-09-14T00:00:00Z', discontinued_at: null,
        roaster_slug: 'roaster', roaster_name: 'Roaster', website_url: 'https://shop.test', city: null, trusted_hosts_json: '["shop.test"]' };
      const db: CatalogDatabase = { prepare(sql) { return { bind() { return this; }, async first<T>() { return sql.includes('FROM coffees c') ? row as T : null; }, async all<T>() { return { results: [] as T[], success: true }; } }; }, async batch() { throw new Error('Unexpected write'); } };
      const coffee = await getCoffeeDetail(db, 'coffee'); assert.ok(coffee);
      assert.equal(coffee.canonicalUrl, url); assert.equal(coffee.sourceUrl, allowed ? url : null);
      const html = renderToStaticMarkup(createElement(DiscoveryDetail, { coffee }));
      assert.doesNotMatch(html, /href="(?:https?:|javascript:|data:)/);
      assert.doesNotMatch(html, /Kaynak ürün sayfası|Kaynak bağlantısı doğrulanmadı/);
    }
  });

  it('adds local secret-scanning and ownership policy files', () => {
    const gitleaks = readFileSync('.gitleaks.toml', 'utf8');
    const codeowners = readFileSync('.github/CODEOWNERS', 'utf8');

    assert.match(gitleaks, /useDefault = true/);
    assert.match(codeowners, /\.github\/workflows\//);
    assert.match(codeowners, /supabase\/migrations\//);
  });
});
