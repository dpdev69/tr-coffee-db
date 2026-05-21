-- Specialty visibility controls.
-- Defaults fail closed: existing and newly scraped coffees remain hidden until
-- classification/backfill explicitly marks them public.

ALTER TABLE coffees
  ADD COLUMN IF NOT EXISTS specialty_status TEXT NOT NULL DEFAULT 'unclassified',
  ADD COLUMN IF NOT EXISTS specialty_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS specialty_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS specialty_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

UPDATE coffees
SET
  specialty_status = coalesce(specialty_status, 'unclassified'),
  specialty_signals = coalesce(specialty_signals, '{}'::jsonb),
  is_public = coalesce(is_public, false);

ALTER TABLE coffees
  ALTER COLUMN specialty_status SET DEFAULT 'unclassified',
  ALTER COLUMN specialty_status SET NOT NULL,
  ALTER COLUMN specialty_signals SET DEFAULT '{}'::jsonb,
  ALTER COLUMN specialty_signals SET NOT NULL,
  ALTER COLUMN is_public SET DEFAULT false,
  ALTER COLUMN is_public SET NOT NULL;

ALTER TABLE roasters
  ADD COLUMN IF NOT EXISTS support_tier TEXT NOT NULL DEFAULT 'unverified';

UPDATE roasters
SET support_tier = coalesce(support_tier, 'unverified');

ALTER TABLE roasters
  ALTER COLUMN support_tier SET DEFAULT 'unverified',
  ALTER COLUMN support_tier SET NOT NULL;

ALTER TABLE scrape_logs
  ADD COLUMN IF NOT EXISTS specialty_qualified INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specialty_rejected INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specialty_unclassified INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coffees_specialty_status_check'
      AND conrelid = 'coffees'::regclass
  ) THEN
    ALTER TABLE coffees
      ADD CONSTRAINT coffees_specialty_status_check
      CHECK (specialty_status IN ('unclassified', 'specialty', 'not_specialty'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coffees_is_public_requires_specialty_check'
      AND conrelid = 'coffees'::regclass
  ) THEN
    ALTER TABLE coffees
      ADD CONSTRAINT coffees_is_public_requires_specialty_check
      CHECK (is_public = false OR specialty_status = 'specialty');
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coffees_specialty_score_check'
      AND conrelid = 'coffees'::regclass
  ) THEN
    ALTER TABLE coffees
      ADD CONSTRAINT coffees_specialty_score_check
      CHECK (specialty_score IS NULL OR (specialty_score >= 0 AND specialty_score <= 100));
  END IF;
END;
$$;

ALTER TABLE coffees
  DROP CONSTRAINT IF EXISTS coffees_specialty_signals_object_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coffees_specialty_signals_json_check'
      AND conrelid = 'coffees'::regclass
  ) THEN
    ALTER TABLE coffees
      ADD CONSTRAINT coffees_specialty_signals_json_check
      CHECK (jsonb_typeof(specialty_signals) IN ('array', 'object'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'roasters_support_tier_check'
      AND conrelid = 'roasters'::regclass
  ) THEN
    ALTER TABLE roasters
      ADD CONSTRAINT roasters_support_tier_check
      CHECK (support_tier IN ('unverified', 'supported', 'priority', 'excluded'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS coffee_specialty_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roaster_id UUID NOT NULL REFERENCES roasters(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  override_action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (roaster_id, external_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'coffee_specialty_overrides_action_check'
      AND conrelid = 'coffee_specialty_overrides'::regclass
  ) THEN
    ALTER TABLE coffee_specialty_overrides
      ADD CONSTRAINT coffee_specialty_overrides_action_check
      CHECK (override_action IN ('force_include', 'force_exclude'));
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS coffee_specialty_overrides_updated_at ON coffee_specialty_overrides;

CREATE TRIGGER coffee_specialty_overrides_updated_at
  BEFORE UPDATE ON coffee_specialty_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE coffee_specialty_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages coffee specialty overrides" ON coffee_specialty_overrides;
CREATE POLICY "Service role manages coffee specialty overrides"
  ON coffee_specialty_overrides FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE coffee_specialty_overrides FROM PUBLIC;
REVOKE ALL ON TABLE coffee_specialty_overrides FROM anon;
REVOKE ALL ON TABLE coffee_specialty_overrides FROM authenticated;
GRANT ALL ON TABLE coffee_specialty_overrides TO service_role;

CREATE INDEX IF NOT EXISTS idx_coffees_public_gate
  ON coffees (is_public, is_available, specialty_status, last_seen_at DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_coffees_public_slug
  ON coffees (slug)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_coffees_roaster_external_id
  ON coffees (roaster_id, external_id);

CREATE INDEX IF NOT EXISTS idx_roasters_support_tier
  ON roasters (support_tier);

CREATE INDEX IF NOT EXISTS idx_coffee_specialty_overrides_roaster_external
  ON coffee_specialty_overrides (roaster_id, external_id);

CREATE INDEX IF NOT EXISTS idx_coffee_specialty_overrides_action
  ON coffee_specialty_overrides (override_action);

CREATE OR REPLACE FUNCTION increment_click(coffee_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE coffees
  SET click_count = click_count + 1
  WHERE id = coffee_id
    AND is_public = true
    AND specialty_status = 'specialty'
    AND is_available = true
    AND last_seen_at >= now() - interval '3 days'
    AND NOT (
      name ILIKE ANY (ARRAY[
        '%filtre kağıdı%',
        '%filtre kagidi%',
        '%filter paper%',
        '%dripper%',
        '%chemex%',
        '%v60%',
        '%hario%',
        '%cafec%',
        '%kalita%',
        '%trapezoid%',
        '%kupa%',
        '%mug%',
        '%fincan%',
        '%takım%',
        '%takimi%',
        '%stoneware%',
        '%server%',
        '%öğütücü%',
        '%ogutucu%',
        '%grinder%',
        '%baratza%',
        '%malhkönig%',
        '%malhkonig%',
        '%kapsül%',
        '%kapsul%',
        '%hediye seti%',
        '%kahve seti%',
        '%tadım paketi%',
        '%tadim paketi%',
        '%deneme paketi%',
        '%keşif seti%',
        '%kesif seti%',
        '%tanışma seti%',
        '%tanisma seti%',
        '%kahveleri seti%',
        '%bardak altl%',
        '%adventure box%',
        '%full collection%',
        '%toptan giriş%',
        '%toptan giris%',
        '%ready to brew%',
        '%içilmeye hazır%',
        '%icilmeye hazir%',
        '%şişe dahil%',
        '%sise dahil%',
        '%çiğ yeşil kahve çekirdek%',
        '%çiğ yeşil çekirdek%',
        '%cig yesil kahve cekirdek%',
        '%cig yesil cekirdek%'
      ])
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

REVOKE EXECUTE ON FUNCTION increment_click(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_click(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_click(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_click(UUID) TO service_role;

CREATE OR REPLACE FUNCTION get_filter_options()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'countries', (
      SELECT json_agg(DISTINCT c.origin_country ORDER BY c.origin_country)
      FROM coffees c
      JOIN roasters r ON r.id = c.roaster_id
      WHERE c.is_public = true
        AND c.specialty_status = 'specialty'
        AND c.is_available = true
        AND c.last_seen_at >= now() - interval '3 days'
        AND c.origin_country IS NOT NULL
        AND r.is_active = true
        AND NOT (
          c.name ILIKE ANY (ARRAY[
            '%filtre kağıdı%', '%filtre kagidi%', '%filter paper%', '%dripper%',
            '%chemex%', '%v60%', '%hario%', '%cafec%', '%kalita%', '%trapezoid%',
            '%kupa%', '%mug%', '%fincan%', '%takım%', '%takimi%', '%stoneware%',
            '%server%', '%öğütücü%', '%ogutucu%', '%grinder%', '%baratza%',
            '%malhkönig%', '%malhkonig%', '%kapsül%', '%kapsul%', '%hediye seti%',
            '%kahve seti%', '%tadım paketi%', '%tadim paketi%', '%deneme paketi%',
            '%keşif seti%', '%kesif seti%', '%tanışma seti%', '%tanisma seti%',
            '%kahveleri seti%', '%bardak altl%', '%adventure box%', '%full collection%',
            '%toptan giriş%', '%toptan giris%', '%ready to brew%', '%içilmeye hazır%',
            '%icilmeye hazir%', '%şişe dahil%', '%sise dahil%',
            '%çiğ yeşil kahve çekirdek%', '%çiğ yeşil çekirdek%',
            '%cig yesil kahve cekirdek%', '%cig yesil cekirdek%'
          ])
        )
    ),
    'processes', (
      SELECT json_agg(DISTINCT c.process ORDER BY c.process)
      FROM coffees c
      JOIN roasters r ON r.id = c.roaster_id
      WHERE c.is_public = true
        AND c.specialty_status = 'specialty'
        AND c.is_available = true
        AND c.last_seen_at >= now() - interval '3 days'
        AND r.is_active = true
        AND NOT (
          c.name ILIKE ANY (ARRAY[
            '%filtre kağıdı%', '%filtre kagidi%', '%filter paper%', '%dripper%',
            '%chemex%', '%v60%', '%hario%', '%cafec%', '%kalita%', '%trapezoid%',
            '%kupa%', '%mug%', '%fincan%', '%takım%', '%takimi%', '%stoneware%',
            '%server%', '%öğütücü%', '%ogutucu%', '%grinder%', '%baratza%',
            '%malhkönig%', '%malhkonig%', '%kapsül%', '%kapsul%', '%hediye seti%',
            '%kahve seti%', '%tadım paketi%', '%tadim paketi%', '%deneme paketi%',
            '%keşif seti%', '%kesif seti%', '%tanışma seti%', '%tanisma seti%',
            '%kahveleri seti%', '%bardak altl%', '%adventure box%', '%full collection%',
            '%toptan giriş%', '%toptan giris%', '%ready to brew%', '%içilmeye hazır%',
            '%icilmeye hazir%', '%şişe dahil%', '%sise dahil%',
            '%çiğ yeşil kahve çekirdek%', '%çiğ yeşil çekirdek%',
            '%cig yesil kahve cekirdek%', '%cig yesil cekirdek%'
          ])
        )
    ),
    'roast_levels', (
      SELECT json_agg(DISTINCT c.roast_level ORDER BY c.roast_level)
      FROM coffees c
      JOIN roasters r ON r.id = c.roaster_id
      WHERE c.is_public = true
        AND c.specialty_status = 'specialty'
        AND c.is_available = true
        AND c.last_seen_at >= now() - interval '3 days'
        AND r.is_active = true
        AND NOT (
          c.name ILIKE ANY (ARRAY[
            '%filtre kağıdı%', '%filtre kagidi%', '%filter paper%', '%dripper%',
            '%chemex%', '%v60%', '%hario%', '%cafec%', '%kalita%', '%trapezoid%',
            '%kupa%', '%mug%', '%fincan%', '%takım%', '%takimi%', '%stoneware%',
            '%server%', '%öğütücü%', '%ogutucu%', '%grinder%', '%baratza%',
            '%malhkönig%', '%malhkonig%', '%kapsül%', '%kapsul%', '%hediye seti%',
            '%kahve seti%', '%tadım paketi%', '%tadim paketi%', '%deneme paketi%',
            '%keşif seti%', '%kesif seti%', '%tanışma seti%', '%tanisma seti%',
            '%kahveleri seti%', '%bardak altl%', '%adventure box%', '%full collection%',
            '%toptan giriş%', '%toptan giris%', '%ready to brew%', '%içilmeye hazır%',
            '%icilmeye hazir%', '%şişe dahil%', '%sise dahil%',
            '%çiğ yeşil kahve çekirdek%', '%çiğ yeşil çekirdek%',
            '%cig yesil kahve cekirdek%', '%cig yesil cekirdek%'
          ])
        )
    ),
    'roasters', (
      SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'slug', r.slug) ORDER BY r.name)
      FROM roasters r
      WHERE r.is_active = true
        AND EXISTS (
          SELECT 1
          FROM coffees c
          WHERE c.roaster_id = r.id
            AND c.is_public = true
            AND c.specialty_status = 'specialty'
            AND c.is_available = true
            AND c.last_seen_at >= now() - interval '3 days'
            AND NOT (
              c.name ILIKE ANY (ARRAY[
                '%filtre kağıdı%', '%filtre kagidi%', '%filter paper%', '%dripper%',
                '%chemex%', '%v60%', '%hario%', '%cafec%', '%kalita%', '%trapezoid%',
                '%kupa%', '%mug%', '%fincan%', '%takım%', '%takimi%', '%stoneware%',
                '%server%', '%öğütücü%', '%ogutucu%', '%grinder%', '%baratza%',
                '%malhkönig%', '%malhkonig%', '%kapsül%', '%kapsul%', '%hediye seti%',
                '%kahve seti%', '%tadım paketi%', '%tadim paketi%', '%deneme paketi%',
                '%keşif seti%', '%kesif seti%', '%tanışma seti%', '%tanisma seti%',
                '%kahveleri seti%', '%bardak altl%', '%adventure box%', '%full collection%',
                '%toptan giriş%', '%toptan giris%', '%ready to brew%', '%içilmeye hazır%',
                '%icilmeye hazir%', '%şişe dahil%', '%sise dahil%',
                '%çiğ yeşil kahve çekirdek%', '%çiğ yeşil çekirdek%',
                '%cig yesil kahve cekirdek%', '%cig yesil cekirdek%'
              ])
            )
        )
    ),
    'price_range', (
      SELECT json_build_object(
        'min', MIN(c.price_per_100g),
        'max', MAX(c.price_per_100g)
      )
      FROM coffees c
      JOIN roasters r ON r.id = c.roaster_id
      WHERE c.is_public = true
        AND c.specialty_status = 'specialty'
        AND c.is_available = true
        AND c.last_seen_at >= now() - interval '3 days'
        AND c.price_per_100g IS NOT NULL
        AND r.is_active = true
        AND NOT (
          c.name ILIKE ANY (ARRAY[
            '%filtre kağıdı%', '%filtre kagidi%', '%filter paper%', '%dripper%',
            '%chemex%', '%v60%', '%hario%', '%cafec%', '%kalita%', '%trapezoid%',
            '%kupa%', '%mug%', '%fincan%', '%takım%', '%takimi%', '%stoneware%',
            '%server%', '%öğütücü%', '%ogutucu%', '%grinder%', '%baratza%',
            '%malhkönig%', '%malhkonig%', '%kapsül%', '%kapsul%', '%hediye seti%',
            '%kahve seti%', '%tadım paketi%', '%tadim paketi%', '%deneme paketi%',
            '%keşif seti%', '%kesif seti%', '%tanışma seti%', '%tanisma seti%',
            '%kahveleri seti%', '%bardak altl%', '%adventure box%', '%full collection%',
            '%toptan giriş%', '%toptan giris%', '%ready to brew%', '%içilmeye hazır%',
            '%icilmeye hazir%', '%şişe dahil%', '%sise dahil%',
            '%çiğ yeşil kahve çekirdek%', '%çiğ yeşil çekirdek%',
            '%cig yesil kahve cekirdek%', '%cig yesil cekirdek%'
          ])
        )
    ),
    'total_coffees', (
      SELECT COUNT(*)
      FROM coffees c
      JOIN roasters r ON r.id = c.roaster_id
      WHERE c.is_public = true
        AND c.specialty_status = 'specialty'
        AND c.is_available = true
        AND c.last_seen_at >= now() - interval '3 days'
        AND r.is_active = true
        AND NOT (
          c.name ILIKE ANY (ARRAY[
            '%filtre kağıdı%', '%filtre kagidi%', '%filter paper%', '%dripper%',
            '%chemex%', '%v60%', '%hario%', '%cafec%', '%kalita%', '%trapezoid%',
            '%kupa%', '%mug%', '%fincan%', '%takım%', '%takimi%', '%stoneware%',
            '%server%', '%öğütücü%', '%ogutucu%', '%grinder%', '%baratza%',
            '%malhkönig%', '%malhkonig%', '%kapsül%', '%kapsul%', '%hediye seti%',
            '%kahve seti%', '%tadım paketi%', '%tadim paketi%', '%deneme paketi%',
            '%keşif seti%', '%kesif seti%', '%tanışma seti%', '%tanisma seti%',
            '%kahveleri seti%', '%bardak altl%', '%adventure box%', '%full collection%',
            '%toptan giriş%', '%toptan giris%', '%ready to brew%', '%içilmeye hazır%',
            '%icilmeye hazir%', '%şişe dahil%', '%sise dahil%',
            '%çiğ yeşil kahve çekirdek%', '%çiğ yeşil çekirdek%',
            '%cig yesil kahve cekirdek%', '%cig yesil cekirdek%'
          ])
        )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_filter_options() TO anon;

CREATE OR REPLACE FUNCTION search_coffees(query TEXT)
RETURNS SETOF coffees AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM coffees c
  JOIN roasters r ON r.id = c.roaster_id
  WHERE c.is_public = true
    AND c.specialty_status = 'specialty'
    AND c.is_available = true
    AND c.last_seen_at >= now() - interval '3 days'
    AND r.is_active = true
    AND NOT (
      c.name ILIKE ANY (ARRAY[
        '%filtre kağıdı%', '%filtre kagidi%', '%filter paper%', '%dripper%',
        '%chemex%', '%v60%', '%hario%', '%cafec%', '%kalita%', '%trapezoid%',
        '%kupa%', '%mug%', '%fincan%', '%takım%', '%takimi%', '%stoneware%',
        '%server%', '%öğütücü%', '%ogutucu%', '%grinder%', '%baratza%',
        '%malhkönig%', '%malhkonig%', '%kapsül%', '%kapsul%', '%hediye seti%',
        '%kahve seti%', '%tadım paketi%', '%tadim paketi%', '%deneme paketi%',
        '%keşif seti%', '%kesif seti%', '%tanışma seti%', '%tanisma seti%',
        '%kahveleri seti%', '%bardak altl%', '%adventure box%', '%full collection%',
        '%toptan giriş%', '%toptan giris%', '%ready to brew%', '%içilmeye hazır%',
        '%icilmeye hazir%', '%şişe dahil%', '%sise dahil%',
        '%çiğ yeşil kahve çekirdek%', '%çiğ yeşil çekirdek%',
        '%cig yesil kahve cekirdek%', '%cig yesil cekirdek%'
      ])
    )
    AND to_tsvector('simple',
      coalesce(c.name, '') || ' ' ||
      coalesce(c.name_normalized, '') || ' ' ||
      coalesce(c.origin_country, '') || ' ' ||
      coalesce(c.origin_region, '') || ' ' ||
      coalesce(c.variety, '') || ' ' ||
      coalesce(c.process, '')
    ) @@ plainto_tsquery('simple', query)
  ORDER BY ts_rank(
    to_tsvector('simple',
      coalesce(c.name, '') || ' ' ||
      coalesce(c.name_normalized, '') || ' ' ||
      coalesce(c.origin_country, '') || ' ' ||
      coalesce(c.origin_region, '') || ' ' ||
      coalesce(c.variety, '') || ' ' ||
      coalesce(c.process, '')
    ),
    plainto_tsquery('simple', query)
  ) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION search_coffees(TEXT) TO anon;

NOTIFY pgrst, 'reload schema';
