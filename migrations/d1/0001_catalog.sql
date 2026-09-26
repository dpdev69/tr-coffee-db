-- Canonical catalog. D1/SQLite semantics; never apply the legacy PostgreSQL migrations here.
PRAGMA foreign_keys = ON;
CREATE TABLE roasters (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  website_url TEXT NOT NULL, city TEXT, adapter TEXT NOT NULL,
  trusted_hosts_json TEXT NOT NULL CHECK(json_valid(trusted_hosts_json)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  last_attempt_at TEXT, last_success_at TEXT, crawl_health TEXT NOT NULL DEFAULT 'unknown',
  revision INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE TABLE crawl_runs (
  id TEXT PRIMARY KEY, roaster_id TEXT NOT NULL REFERENCES roasters(id),
  started_at TEXT NOT NULL, completed_at TEXT, status TEXT NOT NULL CHECK(status IN ('running','success','partial','failed')),
  mode TEXT NOT NULL CHECK(mode IN ('live','baseline','import')),
  parser_version TEXT NOT NULL, products_seen INTEGER NOT NULL DEFAULT 0, offers_seen INTEGER NOT NULL DEFAULT 0,
  diagnostics_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(diagnostics_json)),
  input_hash TEXT, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE crawl_errors (
  id TEXT PRIMARY KEY, crawl_run_id TEXT NOT NULL REFERENCES crawl_runs(id), roaster_id TEXT NOT NULL REFERENCES roasters(id),
  stage TEXT NOT NULL, code TEXT NOT NULL, message TEXT NOT NULL,
  context_json TEXT CHECK(context_json IS NULL OR json_valid(context_json)), created_at TEXT NOT NULL
) STRICT;
CREATE TABLE coffees (
  id TEXT PRIMARY KEY, roaster_id TEXT NOT NULL REFERENCES roasters(id),
  source_product_id TEXT, identity_key TEXT NOT NULL, canonical_url TEXT NOT NULL,
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE,
  raw_metadata_json TEXT NOT NULL CHECK(json_valid(raw_metadata_json)),
  visibility TEXT NOT NULL DEFAULT 'unclassified' CHECK(visibility IN ('public','hidden','unclassified')),
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, discontinued_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(roaster_id, identity_key)
) STRICT;
CREATE UNIQUE INDEX coffees_source_product ON coffees(roaster_id,source_product_id) WHERE source_product_id IS NOT NULL;
CREATE TABLE coffee_aliases (
  roaster_id TEXT NOT NULL REFERENCES roasters(id), alias_type TEXT NOT NULL CHECK(alias_type IN ('url','source','slug')),
  alias TEXT NOT NULL, coffee_id TEXT NOT NULL REFERENCES coffees(id), created_at TEXT NOT NULL,
  PRIMARY KEY(roaster_id,alias_type,alias)
) STRICT;
CREATE TABLE offers (
  id TEXT PRIMARY KEY, coffee_id TEXT NOT NULL REFERENCES coffees(id), source_variant_id TEXT,
  identity_key TEXT NOT NULL, label TEXT, weight_g INTEGER CHECK(weight_g IS NULL OR weight_g > 0),
  currency TEXT CHECK(currency IS NULL OR (length(currency)=3 AND currency=upper(currency))),
  current_price_minor INTEGER CHECK(current_price_minor IS NULL OR current_price_minor >= 0),
  compare_at_price_minor INTEGER CHECK(compare_at_price_minor IS NULL OR compare_at_price_minor >= 0),
  in_stock INTEGER CHECK(in_stock IS NULL OR in_stock IN (0,1)), purchase_url TEXT NOT NULL,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, last_price_change_at TEXT, retired_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(coffee_id,identity_key)
) STRICT;
CREATE UNIQUE INDEX offers_source_variant ON offers(coffee_id,source_variant_id) WHERE source_variant_id IS NOT NULL;
CREATE TABLE price_observations (
  id TEXT PRIMARY KEY, offer_id TEXT NOT NULL REFERENCES offers(id), crawl_run_id TEXT NOT NULL REFERENCES crawl_runs(id),
  price_minor INTEGER CHECK(price_minor IS NULL OR price_minor >= 0), compare_at_minor INTEGER CHECK(compare_at_minor IS NULL OR compare_at_minor >= 0),
  currency TEXT, weight_g INTEGER CHECK(weight_g IS NULL OR weight_g > 0), in_stock INTEGER CHECK(in_stock IS NULL OR in_stock IN (0,1)),
  observed_at TEXT NOT NULL, source TEXT NOT NULL CHECK(source IN ('crawl','import')),
  UNIQUE(offer_id,crawl_run_id)
) STRICT;
CREATE TRIGGER observations_no_update BEFORE UPDATE ON price_observations BEGIN SELECT RAISE(ABORT,'immutable price observation'); END;
CREATE TRIGGER observations_no_delete BEFORE DELETE ON price_observations BEGIN SELECT RAISE(ABORT,'immutable price observation'); END;
CREATE TABLE coffee_events (
  id TEXT PRIMARY KEY, coffee_id TEXT NOT NULL REFERENCES coffees(id), offer_id TEXT REFERENCES offers(id),
  type TEXT NOT NULL CHECK(type IN ('NEW','PRICE_DROP','RESTOCKED','DEAL','OUT_OF_STOCK')),
  created_at TEXT NOT NULL, before_json TEXT NOT NULL CHECK(json_valid(before_json)), after_json TEXT NOT NULL CHECK(json_valid(after_json)),
  idempotency_key TEXT NOT NULL UNIQUE, observation_id TEXT REFERENCES price_observations(id)
) STRICT;
CREATE TABLE coffee_feature_values (
  coffee_id TEXT NOT NULL REFERENCES coffees(id), feature TEXT NOT NULL, value_json TEXT NOT NULL CHECK(json_valid(value_json)),
  source_type TEXT NOT NULL CHECK(source_type IN ('ROASTER_DECLARED','RULE_INFERRED','MANUAL')),
  confidence REAL CHECK(confidence IS NULL OR confidence BETWEEN 0 AND 1), version TEXT NOT NULL, source_reference TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(coffee_id,feature,source_type)
) STRICT;
CREATE TABLE legacy_id_map (
  source_system TEXT NOT NULL, entity_type TEXT NOT NULL, legacy_id TEXT NOT NULL, canonical_id TEXT NOT NULL,
  source_hash TEXT, imported_at TEXT NOT NULL, PRIMARY KEY(source_system,entity_type,legacy_id)
) STRICT;
-- Source preservation for traceability tables only. Private reports/emails must never be imported here.
CREATE TABLE legacy_traceability (
  source_table TEXT NOT NULL, legacy_id TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  imported_at TEXT NOT NULL, PRIMARY KEY(source_table,legacy_id)
) STRICT;
-- First statement of each write batch must assert the snapshot revision. CHECK aborts the whole batch on a stale plan.
CREATE TABLE ingestion_guards (run_id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1)) STRICT;
CREATE INDEX coffees_roaster_current ON coffees(roaster_id,visibility,discontinued_at);
CREATE INDEX coffees_first_seen ON coffees(first_seen_at DESC);
CREATE INDEX offers_coffee_stock ON offers(coffee_id,in_stock,retired_at);
CREATE INDEX observations_offer_time ON price_observations(offer_id,observed_at DESC);
CREATE INDEX events_type_time ON coffee_events(type,created_at DESC);
CREATE INDEX events_coffee_time ON coffee_events(coffee_id,created_at DESC);
CREATE INDEX runs_roaster_time ON crawl_runs(roaster_id,started_at DESC);
CREATE INDEX errors_run ON crawl_errors(crawl_run_id);
CREATE VIEW public_catalog_coffees AS
 SELECT c.* FROM coffees c JOIN roasters r ON r.id=c.roaster_id
 WHERE r.active=1 AND c.visibility='public' AND c.discontinued_at IS NULL
 AND EXISTS(SELECT 1 FROM offers o WHERE o.coffee_id=c.id AND o.retired_at IS NULL AND o.in_stock=1);
-- Freshness is reported independently; an outage never changes stock or silently hides the entire catalog.
CREATE VIEW catalog_counts AS SELECT
 (SELECT count(*) FROM public_catalog_coffees) AS coffees,
 (SELECT count(DISTINCT roaster_id) FROM public_catalog_coffees) AS roasters,
 (SELECT count(*) FROM offers o JOIN public_catalog_coffees c ON c.id=o.coffee_id WHERE o.in_stock=1 AND o.retired_at IS NULL) AS offers;
