import { foldSql } from '../coffee-eligibility';

export const COFFEE_COLUMNS =
  'c.*,r.slug AS roaster_slug,r.name AS roaster_name,r.website_url,r.city,r.trusted_hosts_json';
export const EVENT_TYPES = new Set(['NEW', 'PRICE_DROP', 'RESTOCKED', 'DEAL', 'OUT_OF_STOCK']);
// One package = coffee + weight + price + currency. Grind options at the same price are not separate packages.
export const PACKAGE_KEY =
  "o.coffee_id||'|'||coalesce(o.weight_g,'')||'|'||coalesce(o.current_price_minor,'')||'|'||coalesce(o.currency,'')";
// Every offer read here is a current_offers row (migration 0007): unretired and validated within 7 days of its roaster's last success.
// A listed coffee shows its own offers plus those of current size twins that point at it (migration 0006).
export const GROUP_OFFERS =
  'JOIN coffee_group_members g ON g.group_id=c.id JOIN current_offers o ON o.coffee_id=g.coffee_id';
const IN_GROUP = 'IN (SELECT g.coffee_id FROM coffee_group_members g WHERE g.group_id=c.id)';
// The package a card shows (in stock, closest to 250 g, then cheapest) is the one price sort and price filters use.
export const PREFERRED_PRICE = `(SELECT o.current_price_minor FROM current_offers o WHERE o.coffee_id ${IN_GROUP} AND o.in_stock=1 AND o.currency='TRY' AND o.current_price_minor IS NOT NULL ORDER BY o.weight_g IS NULL,abs(coalesce(o.weight_g,250)-250),o.current_price_minor,o.id LIMIT 1)`;
export const UNIT_PRICE = `(SELECT min(1.0*o.current_price_minor/o.weight_g) FROM current_offers o WHERE o.coffee_id ${IN_GROUP} AND o.in_stock=1 AND o.currency='TRY' AND o.weight_g>0)`;

export const placeholders = (length: number) => Array.from({ length }, () => '?').join(',');

/** The one definition of "new" (alias e = a NEW event): the roaster started selling this coffee between two crawls we can date.
 * A NEW event is emitted only by a live crawl (imports and a roaster's first baseline emit none). It counts when:
 * - the roaster's previous successful crawl ran at most 7 days earlier;
 * - the shop's own date agrees: a Shopify published_at after that previous crawl confirms it, one before it means we
 *   missed the product then. Without a shop date, both crawls must use the same parser version (after a parser or
 *   discovery change, a first sighting can be an old product the old parser missed, so it proves nothing);
 * - no older coffee of the roaster is the same coffee under another identity: same group, same name, or the same name
 *   plus a size ("Koyu" / "Koyu 2.5KG"), which covers a re-identified product, a regrouped size and a re-listing.
 * Rows are never rewritten; past artefact events stay stored and simply fail this rule.
 * ponytail: the name match is a folded-string heuristic (a renamed product reads as new); store a name key if that bites. */
// "a" is "b" plus a size: separators, then a digit ("koyu 2.5kg", "guji (250g)", "guji - 1 kg"). No GLOB on the
// name itself: D1 refuses LIKE/GLOB patterns longer than 50 bytes ("pattern too complex").
const sizeTwin = (a: string, b: string) => {
  const rest = `substr(${a},length(${b})+1)`,
    trimmed = `ltrim(${rest},' -–—(/|,.:')`;
  return `(length(${a})>length(${b}) AND substr(${a},1,length(${b}))=${b} AND ${trimmed}<>${rest} AND ${trimmed} GLOB '[0-9]*')`;
};
export const GENUINE_NEW = `EXISTS(SELECT 1 FROM coffees x JOIN crawl_runs r ON r.id=json_extract(e.after_json,'$.firstObservationRunId') AND r.roaster_id=x.roaster_id
    JOIN crawl_runs p ON p.id=(SELECT q.id FROM crawl_runs q WHERE q.roaster_id=r.roaster_id AND q.status='success' AND q.mode<>'import' AND q.started_at<r.started_at ORDER BY q.started_at DESC LIMIT 1)
    WHERE x.id=e.coffee_id AND julianday(r.started_at)-julianday(p.started_at)<=7
    AND coalesce(julianday(json_extract(x.raw_metadata_json,'$.sourceData.published_at'))>=julianday(p.started_at),p.parser_version=r.parser_version)
    AND NOT EXISTS(SELECT 1 FROM (SELECT s.id,s.canonical_coffee_id,${foldSql('s.name')} AS sn,${foldSql('x.name')} AS xn FROM coffees s
      WHERE s.roaster_id=x.roaster_id AND s.id<>x.id AND julianday(s.first_seen_at)<julianday(r.started_at)) s
      WHERE s.id=x.canonical_coffee_id OR s.canonical_coffee_id=x.id OR s.canonical_coffee_id=x.canonical_coffee_id OR s.sn=s.xn OR ${sizeTwin('s.xn', 's.sn')} OR ${sizeTwin('s.sn', 's.xn')}))`;
/** When the listed coffee (alias c) genuinely arrived, or NULL when that is unknown. */
/** Each listed coffee's genuine arrival time (a.arrived_at), NULL when unknown. Not correlated: computed once per query. */
export const ARRIVALS_JOIN = `LEFT JOIN (SELECT g.group_id,max(e.created_at) AS arrived_at FROM coffee_events e JOIN coffee_group_members g ON g.coffee_id=e.coffee_id WHERE e.type='NEW' AND ${GENUINE_NEW} GROUP BY g.group_id) a ON a.group_id=c.id`;

/** Extra rule an event must meet to still count, as " AND ..." SQL (alias e = the event). */
export function eventValidity(type: string): string {
  if (type === 'NEW') return ` AND ${GENUINE_NEW}`;
  // A deal/drop badge is valid only while its triggering observation still matches the current offer price.
  if (type === 'DEAL' || type === 'PRICE_DROP')
    return ' AND EXISTS(SELECT 1 FROM current_offers o JOIN price_observations p ON p.id=e.observation_id WHERE o.id=e.offer_id AND o.in_stock=1 AND o.current_price_minor=p.price_minor AND o.currency=p.currency AND o.weight_g=p.weight_g)';
  // Another available SKU cannot keep a sold-out/retired package in the restock feed.
  if (type === 'RESTOCKED')
    return ' AND EXISTS(SELECT 1 FROM current_offers o WHERE o.id=e.offer_id AND o.coffee_id=e.coffee_id AND o.in_stock=1)';
  return '';
}
