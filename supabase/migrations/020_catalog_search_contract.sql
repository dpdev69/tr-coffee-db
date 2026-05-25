-- Centralize public catalog gating for SQL search/filter surfaces and keep
-- catalog search on indexed database primitives instead of app-side scans.

CREATE OR REPLACE FUNCTION is_public_catalog_coffee(coffee coffees)
RETURNS BOOLEAN AS $$
  SELECT
    coffee.is_public = true
    AND coffee.specialty_status = 'specialty'
    AND coffee.is_available = true
    AND coffee.last_seen_at >= now() - interval '3 days'
    AND NOT (
      coffee.name ILIKE ANY (ARRAY[
        '%filtre kağıdı%', '%filtre kagidi%', '%filter paper%', '%dripper%',
        '%chemex%', '%v60%', '%hario%', '%cafec%', '%kalita%', '%trapezoid%',
        '%kupa%', '%mug%', '%fincan%', '%takım%', '%takimi%', '%stoneware%',
        '%server%', '%origami%', '%lilydrip%', '%lily drip%',
        '%öğütücü%', '%ogutucu%', '%grinder%', '%değirmen%', '%degirmen%',
        '%terazi%', '%scale%', '%baratza%', '%malhkönig%', '%malhkonig%',
        '%comandante%', '%timemore%', '%kinu%', '%aeropress%',
        '%kapsül%', '%kapsul%', '%eğitim%', '%egitim%', '%course%',
        '%consultancy%', '%danışmanlık%', '%danismanlik%', '%retake%',
        '%foundation%', '%intermediate%', '%professional%', '%hediye seti%',
        '%kahve seti%', '%tadım paketi%', '%tadim paketi%', '%deneme paketi%',
        '%deneme seti%', '%sample box%', '%sample pack%',
        '%keşif seti%', '%kesif seti%', '%tanışma seti%', '%tanisma seti%',
        '%kahveleri seti%', '%bardak altl%', '%adventure box%', '%full collection%',
        '%toptan giriş%', '%toptan giris%', '%ready to brew%', '%yüzen kahve%',
        '%yuzen kahve%', '%içilmeye hazır%', '%icilmeye hazir%',
        '%cam şişe%', '%cam sise%', '%şişe dahil%', '%sise dahil%',
        '%peak water%', '%kahve suyu%', '%aşırı kolay cold brew%',
        '%asiri kolay cold brew%', '%candle%', '%mum%',
        '%çiğ yeşil kahve çekirdek%', '%çiğ yeşil çekirdek%',
        '%cig yesil kahve cekirdek%', '%cig yesil cekirdek%'
      ])
    );
$$ LANGUAGE sql STABLE
SET search_path = public;

CREATE INDEX IF NOT EXISTS idx_coffees_fts_catalog_extended ON coffees USING GIN(
  to_tsvector('simple',
    concat_ws(' ',
      name,
      name_normalized,
      origin_country,
      origin_region,
      origin_farm,
      origin_producer,
      process,
      process_detail,
      roast_level,
      variety,
      array_to_string(flavor_notes, ' '),
      array_to_string(flavor_notes_normalized, ' '),
      array_to_string(flavor_categories, ' '),
      array_to_string(brew_methods, ' ')
    )
  )
);

CREATE OR REPLACE FUNCTION search_coffees(query TEXT)
RETURNS SETOF coffees AS $$
BEGIN
  RETURN QUERY
  WITH normalized_query AS (
    SELECT plainto_tsquery('simple', query) AS q
  ),
  matched AS (
    SELECT
      c AS coffee,
      greatest(
        ts_rank(
          to_tsvector('simple',
            concat_ws(' ',
              c.name,
              c.name_normalized,
              c.origin_country,
              c.origin_region,
              c.origin_farm,
              c.origin_producer,
              c.process,
              c.process_detail,
              c.roast_level,
              c.variety,
              array_to_string(c.flavor_notes, ' '),
              array_to_string(c.flavor_notes_normalized, ' '),
              array_to_string(c.flavor_categories, ' '),
              array_to_string(c.brew_methods, ' ')
            )
          ),
          normalized_query.q
        ),
        ts_rank(
          to_tsvector('simple', coalesce(r.name, '')),
          normalized_query.q
        )
      ) AS rank
    FROM coffees c
    JOIN roasters r ON r.id = c.roaster_id
    CROSS JOIN normalized_query
    WHERE is_public_catalog_coffee(c)
      AND r.is_active = true
      AND (
        to_tsvector('simple',
          concat_ws(' ',
            c.name,
            c.name_normalized,
            c.origin_country,
            c.origin_region,
            c.origin_farm,
            c.origin_producer,
            c.process,
            c.process_detail,
            c.roast_level,
            c.variety,
            array_to_string(c.flavor_notes, ' '),
            array_to_string(c.flavor_notes_normalized, ' '),
            array_to_string(c.flavor_categories, ' '),
            array_to_string(c.brew_methods, ' ')
          )
        ) @@ normalized_query.q
        OR to_tsvector('simple', coalesce(r.name, '')) @@ normalized_query.q
      )
  )
  SELECT (matched.coffee).*
  FROM matched
  ORDER BY matched.rank DESC, (matched.coffee).click_count DESC, (matched.coffee).created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION get_filter_options()
RETURNS JSON AS $$
BEGIN
  RETURN (
    WITH visible_coffees AS (
      SELECT
        c.id,
        c.origin_country,
        c.process,
        c.roast_level,
        r.id AS roaster_id,
        r.name AS roaster_name,
        r.slug AS roaster_slug
      FROM coffees c
      JOIN roasters r ON r.id = c.roaster_id
      WHERE is_public_catalog_coffee(c)
        AND r.is_active = true
    )
    SELECT json_build_object(
      'countries', (
        SELECT json_agg(value ORDER BY value)
        FROM (
          SELECT DISTINCT origin_country AS value
          FROM visible_coffees
          WHERE origin_country IS NOT NULL
        ) country_options
      ),
      'processes', (
        SELECT json_agg(value ORDER BY value)
        FROM (
          SELECT DISTINCT process AS value
          FROM visible_coffees
          WHERE process <> 'unknown'
        ) process_options
      ),
      'roast_levels', (
        SELECT json_agg(value ORDER BY value)
        FROM (
          SELECT DISTINCT roast_level AS value
          FROM visible_coffees
          WHERE roast_level <> 'unknown'
        ) roast_options
      ),
      'roasters', (
        SELECT json_agg(json_build_object('id', id, 'name', name, 'slug', slug) ORDER BY name)
        FROM (
          SELECT DISTINCT roaster_id AS id, roaster_name AS name, roaster_slug AS slug
          FROM visible_coffees
        ) roaster_options
      ),
      'total_coffees', (
        SELECT COUNT(*)
        FROM visible_coffees
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

CREATE OR REPLACE FUNCTION increment_click(coffee_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE coffees c
  SET click_count = click_count + 1
  WHERE c.id = $1
    AND is_public_catalog_coffee(c);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION search_coffees(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_filter_options() TO anon;
GRANT EXECUTE ON FUNCTION increment_click(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
