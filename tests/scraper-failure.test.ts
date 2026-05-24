import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-key';

describe('BaseScraper failure semantics', () => {
  it('returns failed result and writes failed scrape log when product fetch throws', async () => {
    const { supabase } = await import('../scrapers/src/supabase.ts');
    const { BaseScraper } = await import('../scrapers/src/base-scraper.ts');
    const originalFrom = supabase.from.bind(supabase);
    const insertedLogs: unknown[] = [];

    try {
      supabase.from = ((table: string) => {
        if (table === 'roasters') {
          return {
            select() {
              return {
                eq() {
                  return {
                    async single() {
                      return { data: { id: 'roaster-1' }, error: null };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === 'scrape_logs') {
          return {
            async insert(row: unknown) {
              insertedLogs.push(row);
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }) as typeof supabase.from;

      class ThrowingScraper extends BaseScraper {
        async fetchProducts() {
          throw new Error('network timeout');
        }
      }

      const scraper = new ThrowingScraper({
        slug: 'test-roaster',
        name: 'Test Roaster',
        platform: 'custom',
        baseUrl: 'https://example.test',
      });

      const result = await scraper.run();

      assert.equal(result.status, 'failed');
      assert.equal(result.slug, 'test-roaster');
      assert.equal(result.roasterId, 'roaster-1');
      assert.equal(result.productsFound, 0);
      assert.equal(result.productsUpserted, 0);
      assert.equal(result.error, 'network timeout');
      assert.equal(insertedLogs.length, 1);
      assert.deepEqual(
        pickLogFields(insertedLogs[0]),
        {
          roaster_id: 'roaster-1',
          status: 'failed',
          products_found: 0,
          products_upserted: 0,
          error_message: 'network timeout',
        }
      );
    } finally {
      supabase.from = originalFrom;
    }
  });

  it('does not mark existing products stale when a scrape returns zero products', async () => {
    const { supabase } = await import('../scrapers/src/supabase.ts');
    const { BaseScraper } = await import('../scrapers/src/base-scraper.ts');
    const originalFrom = supabase.from.bind(supabase);
    const insertedLogs: unknown[] = [];
    let staleUpdateCalled = false;

    try {
      supabase.from = ((table: string) => {
        if (table === 'roasters') {
          return {
            select() {
              return {
                eq() {
                  return {
                    async single() {
                      return { data: { id: 'roaster-1' }, error: null };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === 'scrape_logs') {
          return {
            async insert(row: unknown) {
              insertedLogs.push(row);
              return { error: null };
            },
          };
        }

        if (table === 'coffees') {
          return {
            update() {
              staleUpdateCalled = true;
              return {
                eq() {
                  return this;
                },
                lt() {
                  return { error: null };
                },
              };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }) as typeof supabase.from;

      class EmptyScraper extends BaseScraper {
        async fetchProducts() {
          return [];
        }
      }

      const scraper = new EmptyScraper({
        slug: 'test-roaster',
        name: 'Test Roaster',
        platform: 'custom',
        websiteUrl: 'https://example.test',
        shopUrl: 'https://example.test',
        city: 'Istanbul',
        priceFormat: 'tl',
      });

      const result = await scraper.run();

      assert.equal(result.status, 'failed');
      assert.equal(result.productsFound, 0);
      assert.equal(result.productsUpserted, 0);
      assert.match(result.error ?? '', /zero products/);
      assert.equal(staleUpdateCalled, false);
      assert.equal(insertedLogs.length, 1);
      assert.deepEqual(
        pickLogFields(insertedLogs[0]),
        {
          roaster_id: 'roaster-1',
          status: 'failed',
          products_found: 0,
          products_upserted: 0,
          error_message:
            'Scrape returned zero products; preserving existing availability until the adapter is verified.',
        }
      );
    } finally {
      supabase.from = originalFrom;
    }
  });

  it('preserves known process and roast metadata when a sparse scrape cannot redetect it', async () => {
    const { supabase } = await import('../scrapers/src/supabase.ts');
    const { BaseScraper } = await import('../scrapers/src/base-scraper.ts');
    const originalFrom = supabase.from.bind(supabase);
    const upsertedRows: Array<Record<string, unknown>> = [];

    try {
      supabase.from = ((table: string) => {
        if (table === 'roasters') {
          return {
            select() {
              return {
                eq() {
                  return {
                    async single() {
                      return { data: { id: 'roaster-1' }, error: null };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === 'coffee_specialty_overrides') {
          return {
            select() {
              return {
                eq() {
                  return { data: [], error: null };
                },
              };
            },
          };
        }

        if (table === 'coffees') {
          return {
            select(columns: string) {
              assert.equal(columns, 'external_id, process, process_detail, roast_level');
              return {
                eq() {
                  return {
                    in() {
                      return {
                        data: [
                          {
                            external_id: 'product-1',
                            process: 'washed',
                            process_detail: 'Yıkanmış',
                            roast_level: 'medium_light',
                          },
                        ],
                        error: null,
                      };
                    },
                  };
                },
              };
            },
            upsert(rows: Array<Record<string, unknown>>) {
              upsertedRows.push(...rows);
              return {
                select() {
                  return { error: null, count: rows.length };
                },
              };
            },
            update() {
              return {
                eq() {
                  return this;
                },
                lt() {
                  return { error: null };
                },
              };
            },
          };
        }

        if (table === 'scrape_logs') {
          return {
            async insert() {
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }) as typeof supabase.from;

      class SparseScraper extends BaseScraper {
        async fetchProducts() {
          return [
            {
              externalId: 'product-1',
              name: 'Colombia Sparse Coffee',
              description: 'Single origin coffee with caramel notes.',
              price: 500,
              currency: 'TRY',
              weightGrams: 250,
              imageUrl: null,
              productUrl: 'https://example.test/products/colombia-sparse-coffee',
              isAvailable: true,
              tags: [],
            },
          ];
        }
      }

      const scraper = new SparseScraper({
        slug: 'test-roaster',
        name: 'Test Roaster',
        platform: 'custom',
        websiteUrl: 'https://example.test',
        shopUrl: 'https://example.test',
        city: 'Istanbul',
        priceFormat: 'tl',
      });

      const result = await scraper.run();

      assert.equal(result.status, 'success');
      assert.equal(upsertedRows.length, 1);
      assert.equal(upsertedRows[0].process, 'washed');
      assert.equal(upsertedRows[0].process_detail, 'Yıkanmış');
      assert.equal(upsertedRows[0].roast_level, 'medium_light');
    } finally {
      supabase.from = originalFrom;
    }
  });
});

function pickLogFields(log: unknown) {
  assert.ok(log && typeof log === 'object');
  const row = log as Record<string, unknown>;

  return {
    roaster_id: row.roaster_id,
    status: row.status,
    products_found: row.products_found,
    products_upserted: row.products_upserted,
    error_message: row.error_message,
  };
}
