-- Make metadata gaps visible to filter UIs and backfill safe process names.

UPDATE coffees
SET
  process = 'anaerobic',
  process_detail = COALESCE(process_detail, 'Anaerobic')
WHERE process = 'unknown'
  AND (
    name ILIKE '%anaerobic%'
    OR name ILIKE '%anaerobik%'
    OR name ILIKE '%carbonic%'
    OR name ILIKE '%karbonik%'
    OR name ILIKE '%karbik%'
  );

UPDATE coffees
SET
  process = 'experimental',
  process_detail = COALESCE(process_detail, 'Experimental')
WHERE process = 'unknown'
  AND (
    name ILIKE '%experimental%'
    OR name ILIKE '%deneysel%'
    OR name ILIKE '%double ferment%'
    OR name ILIKE '%thermal shock%'
  );

UPDATE coffees
SET
  process = 'honey',
  process_detail = COALESCE(process_detail, 'Honey')
WHERE process = 'unknown'
  AND name ILIKE '%honey%';

UPDATE coffees
SET
  process = 'washed',
  process_detail = COALESCE(process_detail, 'Yıkanmış')
WHERE process = 'unknown'
  AND (
    name ILIKE '%washed%'
    OR name ILIKE '%yıkanmış%'
    OR name ILIKE '%yikanmis%'
  );

UPDATE coffees
SET
  process = 'natural',
  process_detail = COALESCE(process_detail, 'Natural')
WHERE process = 'unknown'
  AND (
    name ILIKE '%natural%'
    OR name ILIKE '%natürel%'
    OR name ILIKE '%naturel%'
    OR name ILIKE '%doğal%'
    OR name ILIKE '%dogal%'
  );

CREATE OR REPLACE FUNCTION get_filter_options()
RETURNS JSON AS $$
BEGIN
  RETURN json_build_object(
    'countries', (
      SELECT json_agg(DISTINCT origin_country ORDER BY origin_country)
      FROM coffees
      WHERE is_available = true AND origin_country IS NOT NULL
    ),
    'processes', (
      SELECT json_agg(DISTINCT process ORDER BY process)
      FROM coffees
      WHERE is_available = true
    ),
    'roast_levels', (
      SELECT json_agg(DISTINCT roast_level ORDER BY roast_level)
      FROM coffees
      WHERE is_available = true
    ),
    'roasters', (
      SELECT json_agg(json_build_object('id', r.id, 'name', r.name, 'slug', r.slug) ORDER BY r.name)
      FROM roasters r
      WHERE r.is_active = true
    ),
    'price_range', (
      SELECT json_build_object(
        'min', MIN(price_per_100g),
        'max', MAX(price_per_100g)
      )
      FROM coffees
      WHERE is_available = true AND price_per_100g IS NOT NULL
    ),
    'total_coffees', (
      SELECT COUNT(*) FROM coffees WHERE is_available = true
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION get_filter_options() TO anon;
