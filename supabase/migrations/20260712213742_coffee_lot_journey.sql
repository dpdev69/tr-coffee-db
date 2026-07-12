-- Rebuild the catalog around canonical green coffee lots while preserving
-- `coffees` as the retail offering/read model used by the current app.
-- Existing scraped facts are backfilled as `observed`, never as verified.

CREATE TABLE IF NOT EXISTS supply_chain_organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL,
  country TEXT,
  region TEXT,
  website_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supply_chain_organizations_type_check CHECK (
    organization_type IN (
      'producer', 'farm', 'cooperative', 'washing_station', 'dry_mill',
      'exporter', 'importer', 'dealer', 'wholesaler', 'warehouse',
      'roaster', 'retailer', 'certifier', 'other'
    )
  ),
  CONSTRAINT supply_chain_organizations_website_url_check CHECK (
    website_url IS NULL OR (
      website_url ~* '^https?://[^/?#[:space:]@]+'
      AND website_url !~ '[[:space:]]'
      AND website_url !~* '^https?://[^/?#]*@'
    )
  )
);

ALTER TABLE roasters
  ADD COLUMN IF NOT EXISTS organization_id UUID
  REFERENCES supply_chain_organizations(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roasters_organization
  ON roasters(organization_id)
  WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coffee_lots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_code TEXT,
  display_name TEXT NOT NULL,
  origin_country TEXT,
  origin_region TEXT,
  farm_name TEXT,
  producer_name TEXT,
  altitude_text TEXT,
  harvest_year TEXT,
  process TEXT NOT NULL DEFAULT 'unknown',
  process_detail TEXT,
  varieties TEXT[] NOT NULL DEFAULT '{}',
  traceability_score SMALLINT NOT NULL DEFAULT 0,
  validation_status TEXT NOT NULL DEFAULT 'observed',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coffee_lots_traceability_score_check CHECK (
    traceability_score BETWEEN 0 AND 100
  ),
  CONSTRAINT coffee_lots_validation_status_check CHECK (
    validation_status IN (
      'observed', 'self_reported', 'corroborated', 'partner_confirmed',
      'document_verified', 'independently_assessed', 'disputed', 'expired'
    )
  )
);

ALTER TABLE coffees
  ADD COLUMN IF NOT EXISTS green_lot_id UUID
  REFERENCES coffee_lots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coffees_green_lot ON coffees(green_lot_id);

CREATE TABLE IF NOT EXISTS lot_organizations (
  lot_id UUID NOT NULL REFERENCES coffee_lots(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES supply_chain_organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  validation_status TEXT NOT NULL DEFAULT 'observed',
  valid_from DATE,
  valid_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lot_id, organization_id, role),
  CONSTRAINT lot_organizations_role_check CHECK (
    role IN (
      'producer', 'farm', 'cooperative', 'processor', 'miller', 'exporter',
      'importer', 'dealer', 'wholesaler', 'warehouse', 'roaster', 'retailer'
    )
  ),
  CONSTRAINT lot_organizations_validation_status_check CHECK (
    validation_status IN (
      'observed', 'self_reported', 'corroborated', 'partner_confirmed',
      'document_verified', 'independently_assessed', 'disputed', 'expired'
    )
  ),
  CONSTRAINT lot_organizations_validity_check CHECK (
    valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from
  )
);

CREATE INDEX IF NOT EXISTS idx_lot_organizations_organization
  ON lot_organizations(organization_id, role);

CREATE TABLE IF NOT EXISTS trace_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coffee_id UUID REFERENCES coffees(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES coffee_lots(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  publisher TEXT,
  observed_at TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trace_sources_subject_check CHECK (
    coffee_id IS NOT NULL OR lot_id IS NOT NULL
  ),
  CONSTRAINT trace_sources_type_check CHECK (
    source_type IN (
      'product_page', 'roaster_submission', 'partner_submission', 'certificate',
      'assessment', 'competition_result', 'trade_document', 'independent_research',
      'other'
    )
  ),
  CONSTRAINT trace_sources_url_check CHECK (
    source_url IS NULL OR (
      source_url ~* '^https?://[^/?#[:space:]@]+'
      AND source_url !~ '[[:space:]]'
      AND source_url !~* '^https?://[^/?#]*@'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trace_sources_product_page
  ON trace_sources(coffee_id, source_type, source_url)
  WHERE coffee_id IS NOT NULL AND source_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trace_sources_lot
  ON trace_sources(lot_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS coffee_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_type TEXT NOT NULL,
  subject_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  value JSONB NOT NULL,
  source_id UUID REFERENCES trace_sources(id) ON DELETE SET NULL,
  validation_status TEXT NOT NULL DEFAULT 'observed',
  confidence SMALLINT NOT NULL DEFAULT 50,
  observed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coffee_claims_subject_type_check CHECK (
    subject_type IN (
      'coffee_lot', 'coffee', 'organization', 'trace_event',
      'assessment', 'certification'
    )
  ),
  CONSTRAINT coffee_claims_validation_status_check CHECK (
    validation_status IN (
      'observed', 'self_reported', 'corroborated', 'partner_confirmed',
      'document_verified', 'independently_assessed', 'disputed', 'expired'
    )
  ),
  CONSTRAINT coffee_claims_confidence_check CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT coffee_claims_expiry_check CHECK (
    expires_at IS NULL OR observed_at IS NULL OR expires_at >= observed_at
  )
);

CREATE INDEX IF NOT EXISTS idx_coffee_claims_subject
  ON coffee_claims(subject_type, subject_id, field_name);

CREATE INDEX IF NOT EXISTS idx_coffee_claims_public_validation
  ON coffee_claims(validation_status, observed_at DESC)
  WHERE is_public = true;

CREATE TABLE IF NOT EXISTS trace_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_key TEXT UNIQUE,
  lot_id UUID NOT NULL REFERENCES coffee_lots(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  organization_id UUID REFERENCES supply_chain_organizations(id) ON DELETE SET NULL,
  sequence_number INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  event_at TIMESTAMPTZ,
  location_name TEXT,
  location_region TEXT,
  location_country TEXT,
  source_id UUID REFERENCES trace_sources(id) ON DELETE SET NULL,
  validation_status TEXT NOT NULL DEFAULT 'observed',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trace_events_type_check CHECK (
    event_type IN (
      'produced', 'harvested', 'processed', 'milled', 'aggregated', 'exported',
      'imported', 'received', 'stored', 'roasted', 'packaged', 'listed'
    )
  ),
  CONSTRAINT trace_events_validation_status_check CHECK (
    validation_status IN (
      'observed', 'self_reported', 'corroborated', 'partner_confirmed',
      'document_verified', 'independently_assessed', 'disputed', 'expired'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_trace_events_lot_sequence
  ON trace_events(lot_id, sequence_number, event_at);

CREATE INDEX IF NOT EXISTS idx_trace_events_organization
  ON trace_events(organization_id, event_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS coffee_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id UUID NOT NULL REFERENCES coffee_lots(id) ON DELETE CASCADE,
  coffee_id UUID REFERENCES coffees(id) ON DELETE SET NULL,
  protocol TEXT NOT NULL,
  assessment_type TEXT NOT NULL DEFAULT 'affective',
  score NUMERIC(5,2),
  assessor_name TEXT,
  assessor_organization TEXT,
  assessed_at DATE,
  dimensions JSONB NOT NULL DEFAULT '{}',
  source_id UUID REFERENCES trace_sources(id) ON DELETE SET NULL,
  validation_status TEXT NOT NULL DEFAULT 'observed',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coffee_assessments_score_check CHECK (score IS NULL OR score BETWEEN 0 AND 100),
  CONSTRAINT coffee_assessments_type_check CHECK (
    assessment_type IN ('physical', 'descriptive', 'affective', 'extrinsic', 'legacy_score')
  ),
  CONSTRAINT coffee_assessments_validation_status_check CHECK (
    validation_status IN (
      'observed', 'self_reported', 'corroborated', 'partner_confirmed',
      'document_verified', 'independently_assessed', 'disputed', 'expired'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coffee_assessments_source_protocol
  ON coffee_assessments(lot_id, source_id, protocol)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coffee_assessments_public_score
  ON coffee_assessments(score DESC, assessed_at DESC)
  WHERE is_public = true AND score IS NOT NULL;

CREATE TABLE IF NOT EXISTS coffee_certifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lot_id UUID NOT NULL REFERENCES coffee_lots(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES supply_chain_organizations(id) ON DELETE SET NULL,
  scheme TEXT NOT NULL,
  certificate_number TEXT,
  holder_name TEXT,
  valid_from DATE,
  valid_to DATE,
  source_id UUID REFERENCES trace_sources(id) ON DELETE SET NULL,
  validation_status TEXT NOT NULL DEFAULT 'observed',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coffee_certifications_validation_status_check CHECK (
    validation_status IN (
      'observed', 'self_reported', 'corroborated', 'partner_confirmed',
      'document_verified', 'independently_assessed', 'disputed', 'expired'
    )
  ),
  CONSTRAINT coffee_certifications_validity_check CHECK (
    valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from
  )
);

CREATE INDEX IF NOT EXISTS idx_coffee_certifications_lot
  ON coffee_certifications(lot_id, scheme, valid_to DESC);

-- Keep updated_at behavior aligned with existing roasters/coffees records.
DROP TRIGGER IF EXISTS supply_chain_organizations_updated_at ON supply_chain_organizations;
CREATE TRIGGER supply_chain_organizations_updated_at
  BEFORE UPDATE ON supply_chain_organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS coffee_lots_updated_at ON coffee_lots;
CREATE TRIGGER coffee_lots_updated_at
  BEFORE UPDATE ON coffee_lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS coffee_claims_updated_at ON coffee_claims;
CREATE TRIGGER coffee_claims_updated_at
  BEFORE UPDATE ON coffee_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trace_events_updated_at ON trace_events;
CREATE TRIGGER trace_events_updated_at
  BEFORE UPDATE ON trace_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS coffee_assessments_updated_at ON coffee_assessments;
CREATE TRIGGER coffee_assessments_updated_at
  BEFORE UPDATE ON coffee_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS coffee_certifications_updated_at ON coffee_certifications;
CREATE TRIGGER coffee_certifications_updated_at
  BEFORE UPDATE ON coffee_certifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Roasters become the first verified organization class in the graph. IDs are
-- deterministic so the backfill remains safe to replay in development.
INSERT INTO supply_chain_organizations (
  id, slug, name, organization_type, region, website_url, is_public
)
SELECT
  uuid_generate_v5(uuid_ns_url(), 'https://trcoffeedb.com/organizations/roaster/' || r.id::text),
  'roaster-' || r.slug,
  r.name,
  'roaster',
  r.city,
  r.website_url,
  r.is_active
FROM roasters r
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  region = EXCLUDED.region,
  website_url = EXCLUDED.website_url,
  is_public = EXCLUDED.is_public;

UPDATE roasters r
SET organization_id = o.id
FROM supply_chain_organizations o
WHERE o.slug = 'roaster-' || r.slug
  AND r.organization_id IS DISTINCT FROM o.id;

-- Each current retail offering starts with its own canonical lot. Those lots
-- can later be merged when multiple roasters or packages resolve to one green lot.
INSERT INTO coffee_lots (
  id,
  display_name,
  origin_country,
  origin_region,
  farm_name,
  producer_name,
  altitude_text,
  harvest_year,
  process,
  process_detail,
  varieties,
  traceability_score,
  validation_status,
  is_public
)
SELECT
  uuid_generate_v5(uuid_ns_url(), 'https://trcoffeedb.com/lots/' || c.id::text),
  COALESCE(c.name_normalized, c.name),
  c.origin_country,
  c.origin_region,
  c.origin_farm,
  c.origin_producer,
  c.origin_altitude,
  c.harvest_year,
  c.process,
  c.process_detail,
  CASE WHEN c.variety IS NULL OR btrim(c.variety) = '' THEN '{}'::TEXT[] ELSE ARRAY[c.variety] END,
  LEAST(100,
    CASE WHEN c.origin_country IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN c.origin_region IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN c.origin_farm IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN c.origin_producer IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN c.origin_altitude IS NOT NULL THEN 5 ELSE 0 END +
    CASE WHEN c.harvest_year IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN c.process IS NOT NULL AND c.process <> 'unknown' THEN 10 ELSE 0 END +
    CASE WHEN c.variety IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN c.sca_score IS NOT NULL THEN 10 ELSE 0 END
  )::SMALLINT,
  'observed',
  c.is_public
FROM coffees c
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  origin_country = EXCLUDED.origin_country,
  origin_region = EXCLUDED.origin_region,
  farm_name = EXCLUDED.farm_name,
  producer_name = EXCLUDED.producer_name,
  altitude_text = EXCLUDED.altitude_text,
  harvest_year = EXCLUDED.harvest_year,
  process = EXCLUDED.process,
  process_detail = EXCLUDED.process_detail,
  varieties = EXCLUDED.varieties,
  traceability_score = EXCLUDED.traceability_score,
  is_public = EXCLUDED.is_public;

UPDATE coffees c
SET green_lot_id = uuid_generate_v5(uuid_ns_url(), 'https://trcoffeedb.com/lots/' || c.id::text)
WHERE c.green_lot_id IS NULL;

INSERT INTO lot_organizations (
  lot_id, organization_id, role, is_primary, validation_status
)
SELECT c.green_lot_id, r.organization_id, 'roaster', true, 'observed'
FROM coffees c
JOIN roasters r ON r.id = c.roaster_id
WHERE c.green_lot_id IS NOT NULL
  AND r.organization_id IS NOT NULL
ON CONFLICT (lot_id, organization_id, role) DO NOTHING;

INSERT INTO trace_sources (
  id, coffee_id, lot_id, source_type, title, source_url, publisher,
  observed_at, retrieved_at, is_public
)
SELECT
  uuid_generate_v5(uuid_ns_url(), 'https://trcoffeedb.com/sources/product/' || c.id::text),
  c.id,
  c.green_lot_id,
  'product_page',
  COALESCE(c.name_normalized, c.name) || ' ürün sayfası',
  c.product_url,
  r.name,
  c.last_seen_at,
  COALESCE(c.last_scraped_at, c.updated_at, now()),
  c.is_public
FROM coffees c
JOIN roasters r ON r.id = c.roaster_id
WHERE c.green_lot_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  source_url = EXCLUDED.source_url,
  lot_id = EXCLUDED.lot_id,
  title = EXCLUDED.title,
  publisher = EXCLUDED.publisher,
  observed_at = EXCLUDED.observed_at,
  retrieved_at = EXCLUDED.retrieved_at,
  is_public = EXCLUDED.is_public;

INSERT INTO coffee_claims (
  subject_type, subject_id, field_name, value, source_id,
  validation_status, confidence, observed_at, is_public
)
SELECT
  'coffee_lot',
  c.green_lot_id,
  facts.field_name,
  jsonb_build_object('value', facts.field_value),
  s.id,
  'observed',
  60,
  c.last_seen_at,
  c.is_public
FROM coffees c
JOIN trace_sources s
  ON s.coffee_id = c.id AND s.source_type = 'product_page'
CROSS JOIN LATERAL (
  VALUES
    ('origin_country', c.origin_country),
    ('origin_region', c.origin_region),
    ('farm_name', c.origin_farm),
    ('producer_name', c.origin_producer),
    ('altitude_text', c.origin_altitude),
    ('harvest_year', c.harvest_year),
    ('process', NULLIF(c.process, 'unknown')),
    ('process_detail', c.process_detail),
    ('variety', c.variety),
    ('published_score', c.sca_score::TEXT)
) AS facts(field_name, field_value)
WHERE c.green_lot_id IS NOT NULL
  AND facts.field_value IS NOT NULL
  AND btrim(facts.field_value) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM coffee_claims existing
    WHERE existing.subject_type = 'coffee_lot'
      AND existing.subject_id = c.green_lot_id
      AND existing.field_name = facts.field_name
      AND existing.source_id = s.id
  );

INSERT INTO trace_events (
  external_key, lot_id, event_type, organization_id, sequence_number,
  title, description, event_at, location_name, location_region,
  location_country, source_id, validation_status, is_public
)
SELECT
  'origin:' || c.id::text,
  c.green_lot_id,
  'produced',
  NULL,
  10,
  COALESCE(c.origin_farm, c.origin_region, c.origin_country, 'Köken'),
  CASE
    WHEN c.origin_producer IS NOT NULL THEN c.origin_producer || ' tarafından üretildiği belirtiliyor.'
    ELSE 'Köken bilgisi kavurucunun ürün sayfasından gözlemlendi.'
  END,
  NULL,
  c.origin_farm,
  c.origin_region,
  c.origin_country,
  s.id,
  'observed',
  c.is_public
FROM coffees c
JOIN trace_sources s ON s.coffee_id = c.id AND s.source_type = 'product_page'
WHERE c.green_lot_id IS NOT NULL
  AND (c.origin_country IS NOT NULL OR c.origin_region IS NOT NULL OR c.origin_farm IS NOT NULL)
ON CONFLICT (external_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  location_name = EXCLUDED.location_name,
  location_region = EXCLUDED.location_region,
  location_country = EXCLUDED.location_country,
  source_id = EXCLUDED.source_id,
  is_public = EXCLUDED.is_public;

INSERT INTO trace_events (
  external_key, lot_id, event_type, sequence_number, title, description,
  location_region, location_country, source_id, validation_status, is_public
)
SELECT
  'processed:' || c.id::text,
  c.green_lot_id,
  'processed',
  30,
  c.process || ' işleme',
  c.process_detail,
  c.origin_region,
  c.origin_country,
  s.id,
  'observed',
  c.is_public
FROM coffees c
JOIN trace_sources s ON s.coffee_id = c.id AND s.source_type = 'product_page'
WHERE c.green_lot_id IS NOT NULL
  AND c.process <> 'unknown'
ON CONFLICT (external_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  location_region = EXCLUDED.location_region,
  location_country = EXCLUDED.location_country,
  source_id = EXCLUDED.source_id,
  is_public = EXCLUDED.is_public;

INSERT INTO trace_events (
  external_key, lot_id, event_type, organization_id, sequence_number,
  title, description, event_at, location_region, source_id,
  validation_status, is_public
)
SELECT
  'roasted:' || c.id::text,
  c.green_lot_id,
  'roasted',
  r.organization_id,
  80,
  r.name || ' tarafından kavruldu',
  CASE WHEN c.roast_level <> 'unknown' THEN c.roast_level || ' kavrum olarak listelendi.' ELSE NULL END,
  NULL,
  r.city,
  s.id,
  'observed',
  c.is_public
FROM coffees c
JOIN roasters r ON r.id = c.roaster_id
JOIN trace_sources s ON s.coffee_id = c.id AND s.source_type = 'product_page'
WHERE c.green_lot_id IS NOT NULL
ON CONFLICT (external_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  event_at = EXCLUDED.event_at,
  location_region = EXCLUDED.location_region,
  source_id = EXCLUDED.source_id,
  is_public = EXCLUDED.is_public;

INSERT INTO trace_events (
  external_key, lot_id, event_type, organization_id, sequence_number,
  title, description, event_at, source_id, validation_status, is_public
)
SELECT
  'listed:' || c.id::text,
  c.green_lot_id,
  'listed',
  r.organization_id,
  90,
  'Türkiye pazarında listelendi',
  CASE
    WHEN c.price_amount IS NOT NULL THEN c.price_amount::TEXT || ' ' || c.price_currency || ' fiyatla gözlemlendi.'
    ELSE 'Kavurucunun mağazasında gözlemlendi.'
  END,
  c.last_seen_at,
  s.id,
  'observed',
  c.is_public
FROM coffees c
JOIN roasters r ON r.id = c.roaster_id
JOIN trace_sources s ON s.coffee_id = c.id AND s.source_type = 'product_page'
WHERE c.green_lot_id IS NOT NULL
ON CONFLICT (external_key) DO UPDATE SET
  description = EXCLUDED.description,
  event_at = EXCLUDED.event_at,
  source_id = EXCLUDED.source_id,
  is_public = EXCLUDED.is_public;

INSERT INTO coffee_assessments (
  lot_id, coffee_id, protocol, assessment_type, score, source_id,
  validation_status, is_public
)
SELECT
  c.green_lot_id,
  c.id,
  'roaster_reported_legacy_score',
  'legacy_score',
  c.sca_score,
  s.id,
  'observed',
  c.is_public
FROM coffees c
JOIN trace_sources s ON s.coffee_id = c.id AND s.source_type = 'product_page'
WHERE c.green_lot_id IS NOT NULL
  AND c.sca_score IS NOT NULL
ON CONFLICT (lot_id, source_id, protocol)
WHERE source_id IS NOT NULL
DO UPDATE SET
  score = EXCLUDED.score,
  is_public = EXCLUDED.is_public;

-- Keep the lot read model synchronized for future scraper writes. The trigger
-- watches catalog metadata only, so click-count updates do not rebuild journeys.
CREATE OR REPLACE FUNCTION sync_coffee_journey()
RETURNS TRIGGER AS $$
DECLARE
  target_lot_id UUID;
  target_organization_id UUID;
  target_source_id UUID;
  target_traceability_score SMALLINT;
BEGIN
  target_lot_id := COALESCE(
    NEW.green_lot_id,
    uuid_generate_v5(uuid_ns_url(), 'https://trcoffeedb.com/lots/' || NEW.id::text)
  );
  target_source_id := uuid_generate_v5(
    uuid_ns_url(),
    'https://trcoffeedb.com/sources/product/' || NEW.id::text
  );

  SELECT organization_id INTO target_organization_id
  FROM roasters
  WHERE id = NEW.roaster_id;

  target_traceability_score := LEAST(100,
    CASE WHEN NEW.origin_country IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN NEW.origin_region IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN NEW.origin_farm IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN NEW.origin_producer IS NOT NULL THEN 15 ELSE 0 END +
    CASE WHEN NEW.origin_altitude IS NOT NULL THEN 5 ELSE 0 END +
    CASE WHEN NEW.harvest_year IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN NEW.process <> 'unknown' THEN 10 ELSE 0 END +
    CASE WHEN NEW.variety IS NOT NULL THEN 10 ELSE 0 END +
    CASE WHEN NEW.sca_score IS NOT NULL THEN 10 ELSE 0 END
  )::SMALLINT;

  INSERT INTO coffee_lots (
    id, display_name, origin_country, origin_region, farm_name, producer_name,
    altitude_text, harvest_year, process, process_detail, varieties,
    traceability_score, validation_status, is_public
  ) VALUES (
    target_lot_id,
    COALESCE(NEW.name_normalized, NEW.name),
    NEW.origin_country,
    NEW.origin_region,
    NEW.origin_farm,
    NEW.origin_producer,
    NEW.origin_altitude,
    NEW.harvest_year,
    NEW.process,
    NEW.process_detail,
    CASE
      WHEN NEW.variety IS NULL OR btrim(NEW.variety) = '' THEN '{}'::TEXT[]
      ELSE ARRAY[NEW.variety]
    END,
    target_traceability_score,
    'observed',
    NEW.is_public
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    origin_country = EXCLUDED.origin_country,
    origin_region = EXCLUDED.origin_region,
    farm_name = EXCLUDED.farm_name,
    producer_name = EXCLUDED.producer_name,
    altitude_text = EXCLUDED.altitude_text,
    harvest_year = EXCLUDED.harvest_year,
    process = EXCLUDED.process,
    process_detail = EXCLUDED.process_detail,
    varieties = EXCLUDED.varieties,
    traceability_score = EXCLUDED.traceability_score,
    is_public = EXCLUDED.is_public;

  IF NEW.green_lot_id IS DISTINCT FROM target_lot_id THEN
    UPDATE coffees SET green_lot_id = target_lot_id WHERE id = NEW.id;
  END IF;

  IF target_organization_id IS NOT NULL THEN
    INSERT INTO lot_organizations (
      lot_id, organization_id, role, is_primary, validation_status
    ) VALUES (
      target_lot_id, target_organization_id, 'roaster', true, 'observed'
    )
    ON CONFLICT (lot_id, organization_id, role) DO NOTHING;
  END IF;

  INSERT INTO trace_sources (
    id, coffee_id, lot_id, source_type, title, source_url, publisher,
    observed_at, retrieved_at, is_public
  )
  SELECT
    target_source_id,
    NEW.id,
    target_lot_id,
    'product_page',
    COALESCE(NEW.name_normalized, NEW.name) || ' ürün sayfası',
    NEW.product_url,
    r.name,
    NEW.last_seen_at,
    COALESCE(NEW.last_scraped_at, NEW.updated_at, now()),
    NEW.is_public
  FROM roasters r
  WHERE r.id = NEW.roaster_id
  ON CONFLICT (id) DO UPDATE SET
    source_url = EXCLUDED.source_url,
    lot_id = EXCLUDED.lot_id,
    title = EXCLUDED.title,
    publisher = EXCLUDED.publisher,
    observed_at = EXCLUDED.observed_at,
    retrieved_at = EXCLUDED.retrieved_at,
    is_public = EXCLUDED.is_public;

  DELETE FROM coffee_claims
  WHERE subject_type = 'coffee_lot'
    AND subject_id = target_lot_id
    AND source_id = target_source_id
    AND validation_status = 'observed';

  INSERT INTO coffee_claims (
    subject_type, subject_id, field_name, value, source_id,
    validation_status, confidence, observed_at, is_public
  )
  SELECT
    'coffee_lot',
    target_lot_id,
    facts.field_name,
    jsonb_build_object('value', facts.field_value),
    target_source_id,
    'observed',
    60,
    NEW.last_seen_at,
    NEW.is_public
  FROM (
    VALUES
      ('origin_country', NEW.origin_country),
      ('origin_region', NEW.origin_region),
      ('farm_name', NEW.origin_farm),
      ('producer_name', NEW.origin_producer),
      ('altitude_text', NEW.origin_altitude),
      ('harvest_year', NEW.harvest_year),
      ('process', NULLIF(NEW.process, 'unknown')),
      ('process_detail', NEW.process_detail),
      ('variety', NEW.variety),
      ('published_score', NEW.sca_score::TEXT)
  ) AS facts(field_name, field_value)
  WHERE facts.field_value IS NOT NULL AND btrim(facts.field_value) <> '';

  IF NEW.origin_country IS NOT NULL OR NEW.origin_region IS NOT NULL OR NEW.origin_farm IS NOT NULL THEN
    INSERT INTO trace_events (
      external_key, lot_id, event_type, sequence_number, title, description,
      location_name, location_region, location_country, source_id,
      validation_status, is_public
    ) VALUES (
      'origin:' || NEW.id::text,
      target_lot_id,
      'produced',
      10,
      COALESCE(NEW.origin_farm, NEW.origin_region, NEW.origin_country, 'Köken'),
      CASE
        WHEN NEW.origin_producer IS NOT NULL THEN NEW.origin_producer || ' tarafından üretildiği belirtiliyor.'
        ELSE 'Köken bilgisi kavurucunun ürün sayfasından gözlemlendi.'
      END,
      NEW.origin_farm,
      NEW.origin_region,
      NEW.origin_country,
      target_source_id,
      'observed',
      NEW.is_public
    )
    ON CONFLICT (external_key) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      location_name = EXCLUDED.location_name,
      location_region = EXCLUDED.location_region,
      location_country = EXCLUDED.location_country,
      source_id = EXCLUDED.source_id,
      is_public = EXCLUDED.is_public;
  ELSE
    DELETE FROM trace_events WHERE external_key = 'origin:' || NEW.id::text;
  END IF;

  IF NEW.process <> 'unknown' THEN
    INSERT INTO trace_events (
      external_key, lot_id, event_type, sequence_number, title, description,
      location_region, location_country, source_id, validation_status, is_public
    ) VALUES (
      'processed:' || NEW.id::text,
      target_lot_id,
      'processed',
      30,
      NEW.process || ' işleme',
      NEW.process_detail,
      NEW.origin_region,
      NEW.origin_country,
      target_source_id,
      'observed',
      NEW.is_public
    )
    ON CONFLICT (external_key) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      location_region = EXCLUDED.location_region,
      location_country = EXCLUDED.location_country,
      source_id = EXCLUDED.source_id,
      is_public = EXCLUDED.is_public;
  ELSE
    DELETE FROM trace_events WHERE external_key = 'processed:' || NEW.id::text;
  END IF;

  INSERT INTO trace_events (
    external_key, lot_id, event_type, organization_id, sequence_number,
    title, description, location_region, location_country, source_id,
    validation_status, is_public
  )
  SELECT
    'roasted:' || NEW.id::text,
    target_lot_id,
    'roasted',
    r.organization_id,
    80,
    r.name || ' tarafından kavruldu',
    CASE WHEN NEW.roast_level <> 'unknown' THEN NEW.roast_level || ' kavrum olarak listelendi.' ELSE NULL END,
    r.city,
    'Türkiye',
    target_source_id,
    'observed',
    NEW.is_public
  FROM roasters r
  WHERE r.id = NEW.roaster_id
  ON CONFLICT (external_key) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    location_region = EXCLUDED.location_region,
    source_id = EXCLUDED.source_id,
    is_public = EXCLUDED.is_public;

  INSERT INTO trace_events (
    external_key, lot_id, event_type, organization_id, sequence_number,
    title, description, event_at, location_country, source_id,
    validation_status, is_public
  ) VALUES (
    'listed:' || NEW.id::text,
    target_lot_id,
    'listed',
    target_organization_id,
    90,
    'Türkiye pazarında listelendi',
    CASE
      WHEN NEW.price_amount IS NOT NULL THEN NEW.price_amount::TEXT || ' ' || NEW.price_currency || ' fiyatla gözlemlendi.'
      ELSE 'Kavurucunun mağazasında gözlemlendi.'
    END,
    NEW.last_seen_at,
    'Türkiye',
    target_source_id,
    'observed',
    NEW.is_public
  )
  ON CONFLICT (external_key) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    description = EXCLUDED.description,
    event_at = EXCLUDED.event_at,
    source_id = EXCLUDED.source_id,
    is_public = EXCLUDED.is_public;

  IF NEW.sca_score IS NOT NULL THEN
    INSERT INTO coffee_assessments (
      lot_id, coffee_id, protocol, assessment_type, score, source_id,
      validation_status, is_public
    ) VALUES (
      target_lot_id,
      NEW.id,
      'roaster_reported_legacy_score',
      'legacy_score',
      NEW.sca_score,
      target_source_id,
      'observed',
      NEW.is_public
    )
    ON CONFLICT (lot_id, source_id, protocol)
    WHERE source_id IS NOT NULL
    DO UPDATE SET score = EXCLUDED.score, is_public = EXCLUDED.is_public;
  ELSE
    DELETE FROM coffee_assessments
    WHERE lot_id = target_lot_id
      AND source_id = target_source_id
      AND protocol = 'roaster_reported_legacy_score';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS coffees_sync_journey ON coffees;
CREATE TRIGGER coffees_sync_journey
  AFTER INSERT OR UPDATE OF
    roaster_id, name, name_normalized, origin_country, origin_region,
    origin_farm, origin_altitude, origin_producer, process, process_detail,
    roast_level, variety, harvest_year, roast_date, sca_score, price_amount,
    price_currency, product_url, is_public, last_scraped_at, last_seen_at
  ON coffees
  FOR EACH ROW EXECUTE FUNCTION sync_coffee_journey();

REVOKE ALL ON FUNCTION sync_coffee_journey() FROM PUBLIC, anon, authenticated;

-- Public users can read only records explicitly marked public. Writes remain
-- service-role-only because no public mutation policy is created.
ALTER TABLE supply_chain_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trace_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE trace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffee_certifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads supply chain organizations" ON supply_chain_organizations;
CREATE POLICY "Public reads supply chain organizations"
  ON supply_chain_organizations FOR SELECT TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Public reads coffee lots" ON coffee_lots;
CREATE POLICY "Public reads coffee lots"
  ON coffee_lots FOR SELECT TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Public reads lot organizations" ON lot_organizations;
CREATE POLICY "Public reads lot organizations"
  ON lot_organizations FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coffee_lots l
      WHERE l.id = lot_organizations.lot_id AND l.is_public = true
    )
  );

DROP POLICY IF EXISTS "Public reads trace sources" ON trace_sources;
CREATE POLICY "Public reads trace sources"
  ON trace_sources FOR SELECT TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Public reads coffee claims" ON coffee_claims;
CREATE POLICY "Public reads coffee claims"
  ON coffee_claims FOR SELECT TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Public reads trace events" ON trace_events;
CREATE POLICY "Public reads trace events"
  ON trace_events FOR SELECT TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Public reads coffee assessments" ON coffee_assessments;
CREATE POLICY "Public reads coffee assessments"
  ON coffee_assessments FOR SELECT TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Public reads coffee certifications" ON coffee_certifications;
CREATE POLICY "Public reads coffee certifications"
  ON coffee_certifications FOR SELECT TO anon, authenticated
  USING (is_public = true);

GRANT SELECT ON TABLE
  supply_chain_organizations,
  coffee_lots,
  lot_organizations,
  trace_sources,
  coffee_claims,
  trace_events,
  coffee_assessments,
  coffee_certifications
TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  supply_chain_organizations,
  coffee_lots,
  lot_organizations,
  trace_sources,
  coffee_claims,
  trace_events,
  coffee_assessments,
  coffee_certifications
FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
