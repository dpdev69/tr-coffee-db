-- RPC functions for the frontend

-- Increment click count (called when user clicks "Buy" button)
CREATE OR REPLACE FUNCTION increment_click(coffee_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE coffees
  SET click_count = click_count + 1
  WHERE id = coffee_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Grant execute to anon (public can track clicks)
GRANT EXECUTE ON FUNCTION increment_click(UUID) TO anon;

-- Get available filter options (for dynamic filter UI)
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
      WHERE is_available = true AND process != 'unknown'
    ),
    'roast_levels', (
      SELECT json_agg(DISTINCT roast_level ORDER BY roast_level)
      FROM coffees
      WHERE is_available = true AND roast_level != 'unknown'
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

-- Search coffees using full-text search
CREATE OR REPLACE FUNCTION search_coffees(query TEXT)
RETURNS SETOF coffees AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM coffees
  WHERE is_available = true
    AND to_tsvector('simple',
      coalesce(name, '') || ' ' ||
      coalesce(name_normalized, '') || ' ' ||
      coalesce(origin_country, '') || ' ' ||
      coalesce(origin_region, '') || ' ' ||
      coalesce(variety, '') || ' ' ||
      coalesce(process, '')
    ) @@ plainto_tsquery('simple', query)
  ORDER BY ts_rank(
    to_tsvector('simple',
      coalesce(name, '') || ' ' ||
      coalesce(name_normalized, '') || ' ' ||
      coalesce(origin_country, '') || ' ' ||
      coalesce(origin_region, '') || ' ' ||
      coalesce(variety, '') || ' ' ||
      coalesce(process, '')
    ),
    plainto_tsquery('simple', query)
  ) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION search_coffees(TEXT) TO anon;
