import { cleanCoffeeName, truthfulFeatures, truthfulMetadata } from '../profile-truth';
import type { CatalogDatabase } from '../database';
import { canonicalizeUrl, unitPriceTry } from '../identity';
import type { Json, RawMetadata } from '../types';
import { collapsePackages, eventFromRow, trustedSourceUrl, withoutTrailingSize } from './mappers';
import { COFFEE_COLUMNS, GENUINE_NEW, placeholders } from './sql';
import type { CatalogCoffee, CoffeeRow, EventRow, FeatureRow, OfferRow } from './types';
import { parseJson } from './util';

export async function hydrate(db: CatalogDatabase, rows: CoffeeRow[], now: number): Promise<CatalogCoffee[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const list = placeholders(ids.length);
  const [offers, features, events] = await Promise.all([
    db
      .prepare(
        `SELECT o.*,g.group_id FROM coffee_group_members g JOIN current_offers o ON o.coffee_id=g.coffee_id WHERE g.group_id IN (${list}) ORDER BY o.in_stock DESC NULLS LAST,o.current_price_minor ASC NULLS LAST,o.id`,
      )
      .bind(...ids)
      .all<OfferRow & { group_id: string }>(),
    db
      .prepare(`SELECT * FROM coffee_feature_values WHERE coffee_id IN (${list}) ORDER BY feature,source_type`)
      .bind(...ids)
      .all<FeatureRow>(),
    db
      .prepare(
        `SELECT * FROM (SELECT e.*,g.group_id,row_number() OVER(PARTITION BY g.group_id,e.type ORDER BY e.created_at DESC,e.id DESC) AS position FROM coffee_group_members g JOIN coffee_events e ON e.coffee_id=g.coffee_id WHERE g.group_id IN (${list}) AND (e.type<>'NEW' OR ${GENUINE_NEW})) WHERE position=1 ORDER BY created_at DESC`,
      )
      .bind(...ids)
      .all<EventRow & { group_id: string }>(),
  ]);
  return rows.map((row) => {
    // A group shows its members' sizes, so a size left in the parent's name would describe only one of them.
    const grouped = offers.results.some((o) => o.group_id === row.id && o.coffee_id !== row.id);
    const own = features.results
      .filter((f) => f.coffee_id === row.id)
      .map((f) => ({
        feature: f.feature,
        value: parseJson<Json>(f.value_json, null),
        sourceType: f.source_type,
        confidence: f.confidence,
        version: f.version,
        sourceReference: f.source_reference,
      }));
    return {
      id: row.id,
      name: grouped ? withoutTrailingSize(cleanCoffeeName(row.name)) : cleanCoffeeName(row.name),
      slug: row.slug,
      canonicalUrl: row.canonical_url,
      sourceUrl: trustedSourceUrl(row),
      sourceProductId: row.source_product_id,
      roaster: {
        id: row.roaster_id,
        slug: row.roaster_slug,
        name: row.roaster_name,
        websiteUrl: row.website_url,
        city: row.city,
      },
      rawMetadata: truthfulMetadata(parseJson<RawMetadata>(row.raw_metadata_json, {}), row.name, own),
      features: truthfulFeatures(own, parseJson<RawMetadata>(row.raw_metadata_json, {})),
      offers: collapsePackages(
        offers.results
          .filter((o) => o.group_id === row.id)
          .map((o) => {
            let purchaseUrl: string | null = null;
            try {
              const hosts = parseJson<string[]>(row.trusted_hosts_json, []);
              if (hosts.length) purchaseUrl = canonicalizeUrl(o.purchase_url, hosts);
            } catch {
              /* Invalid imported URL has no purchase action. */
            }
            return {
              id: o.id,
              coffeeId: o.coffee_id,
              sourceVariantId: o.source_variant_id,
              label: o.label,
              weightG: o.weight_g,
              currency: o.currency,
              priceMinor: o.current_price_minor,
              compareAtMinor: o.compare_at_price_minor,
              inStock: o.in_stock === null ? null : o.in_stock === 1,
              purchaseUrl,
              unitPriceTry: unitPriceTry(o.current_price_minor, o.weight_g, o.currency),
              firstSeenAt: o.first_seen_at,
              lastSeenAt: o.last_seen_at,
              lastPriceChangeAt: o.last_price_change_at,
              variantOfferIds: [o.id],
            };
          }),
      ),
      latestEvents: events.results.filter((e) => e.group_id === row.id).map(eventFromRow),
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      discontinuedAt: row.discontinued_at,
      stale: now - Date.parse(row.last_seen_at) > 3 * 86400000,
    };
  });
}

/** Listed coffees by id, in the order given; one that left the catalog since its id was cached is skipped. */
export async function listedRows(db: CatalogDatabase, ids: string[]): Promise<CoffeeRow[]> {
  if (!ids.length) return [];
  const rows = (
    await db
      .prepare(
        `SELECT ${COFFEE_COLUMNS} FROM public_catalog_coffees c JOIN roasters r ON r.id=c.roaster_id WHERE c.id IN (${placeholders(ids.length)})`,
      )
      .bind(...ids)
      .all<CoffeeRow>()
  ).results;
  return ids.flatMap((id) => rows.filter((row) => row.id === id));
}
