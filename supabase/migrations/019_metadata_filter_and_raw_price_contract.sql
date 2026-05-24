-- Keep filter metadata explicit and remove the deprecated 100g comparison range
-- from the public filter-options RPC.

UPDATE coffees
SET process = 'unknown'
WHERE process IS NULL
  OR btrim(process) = '';

UPDATE coffees
SET roast_level = 'unknown'
WHERE roast_level IS NULL
  OR btrim(roast_level) = '';

ALTER TABLE coffees
  ALTER COLUMN process SET DEFAULT 'unknown',
  ALTER COLUMN process SET NOT NULL,
  ALTER COLUMN roast_level SET DEFAULT 'unknown',
  ALTER COLUMN roast_level SET NOT NULL;

UPDATE coffees
SET
  specialty_status = 'not_specialty',
  specialty_rejection_reason = COALESCE(specialty_rejection_reason, 'non_coffee_or_bundle'),
  is_public = false
WHERE is_public = true
  AND (
    name ILIKE ANY (ARRAY[
      '%sample box%', '%sample pack%', '%deneme seti%', '%deneme paketi%',
      '%tadım paketi%', '%tadim paketi%', '%bundle%', '%kampanya%',
      '%origami%', '%lilydrip%', '%lily drip%', '%aeropress%', '%kinu%',
      '%comandante%', '%timemore%', '%peak water%', '%kahve suyu%',
      '%terazi%', '%değirmen%', '%degirmen%', '%grinder%',
      '%consultancy%', '%danışmanlık%', '%danismanlik%', '%retake%',
      '%foundation%', '%intermediate%', '%professional%', '%course%',
      '%eğitim%', '%egitim%', '%sca %', '%q grader%',
      '%cold brew%cam şişe%', '%cold brew%cam sise%', '%yüzen kahve%',
      '%yuzen kahve%', '%aşırı kolay cold brew%', '%asiri kolay cold brew%',
      '%candle%', '%mum%', '%paper chocolate%', '%kakao nibi%',
      '%çiğ yeşil kahve%', '%cig yesil kahve%'
    ])
    OR product_url ILIKE ANY (ARRAY[
      '%sample-box%', '%sample-pack%', '%deneme-seti%', '%deneme-paketi%',
      '%origami%', '%lilydrip%', '%aeropress%', '%comandante%', '%timemore%',
      '%peak-water%', '%consultancy%', '%retake%', '%foundation%',
      '%intermediate%', '%professional%', '%cold-brew%cam-sise%',
      '%yuzen-kahve%', '%asiri-kolay-cold-brew%', '%ready-to-brew-cold-brew%',
      '%candle%', '%mum%', '%wastepresso%', '%paper-chocolate%', '%cig-yesil%'
    ])
  );

UPDATE coffees
SET
  process = 'anaerobic',
  process_detail = COALESCE(process_detail, 'Anaerobic')
WHERE process = 'unknown'
  AND (
    name ILIKE ANY (ARRAY[
      '%anaerobic%', '%anaerobik%', '%anaeorobik%', '%anaeorebik%',
      '%carbonic%', '%karbonik%', '%karbik%'
    ])
    OR product_url ILIKE ANY (ARRAY[
      '%anaerobic%', '%anaerobik%', '%anaeorobik%', '%anaeorebik%',
      '%carbonic%', '%karbonik%', '%karbik%'
    ])
  );

UPDATE coffees
SET
  process = 'experimental',
  process_detail = COALESCE(process_detail, 'Experimental')
WHERE process = 'unknown'
  AND (
    name ILIKE ANY (ARRAY[
      '%experimental%', '%deneysel%', '%thermal shock%', '%lactic%', '%nitro washed%', '%wex%'
    ])
    OR product_url ILIKE ANY (ARRAY[
      '%experimental%', '%deneysel%', '%thermal-shock%', '%lactic%', '%nitro-washed%', '%wex%'
    ])
  );

UPDATE coffees
SET
  process = 'honey',
  process_detail = COALESCE(process_detail, 'Honey')
WHERE process = 'unknown'
  AND (
    name ILIKE '%honey%'
    OR product_url ILIKE '%honey%'
  );

UPDATE coffees
SET
  process = 'washed',
  process_detail = COALESCE(process_detail, 'Washed')
WHERE process = 'unknown'
  AND (
    name ILIKE ANY (ARRAY[
      '%washed%', '%yıkanmış%', '%yikanmis%', '%yikanmış%', '%yıkanmis%'
    ])
    OR product_url ILIKE ANY (ARRAY[
      '%washed%', '%yikanmis%', '%yikanmis%', '%yikanmis%'
    ])
  );

UPDATE coffees
SET
  process = 'natural',
  process_detail = COALESCE(process_detail, 'Natural')
WHERE process = 'unknown'
  AND (
    name ILIKE ANY (ARRAY[
      '%natural%', '%natürel%', '%naturel%', '%dogal%', '%doğal%', '%dry cherry%'
    ])
    OR product_url ILIKE ANY (ARRAY[
      '%natural%', '%naturel%', '%dogal%', '%dry-cherry%'
    ])
  );

UPDATE coffees
SET roast_level = 'dark'
WHERE roast_level = 'unknown'
  AND name ILIKE ANY (ARRAY['% dark %', 'dark %', '% koyu %', 'koyu %']);

UPDATE coffees
SET roast_level = 'medium'
WHERE roast_level = 'unknown'
  AND brew_methods @> ARRAY['espresso']::text[]
  AND brew_methods @> ARRAY['filter']::text[];

UPDATE coffees
SET roast_level = 'medium_dark'
WHERE roast_level = 'unknown'
  AND (
    brew_methods @> ARRAY['espresso']::text[]
    OR brew_methods @> ARRAY['turkish']::text[]
    OR name ILIKE ANY (ARRAY['%espresso%', '%türk kahvesi%', '%turk kahvesi%'])
    OR product_url ILIKE ANY (ARRAY['%espresso%', '%turk-kahvesi%'])
  );

UPDATE coffees
SET roast_level = 'medium_light'
WHERE roast_level = 'unknown'
  AND (
    brew_methods && ARRAY['filter', 'aeropress', 'french_press', 'cold_brew', 'moka_pot']::text[]
    OR name ILIKE ANY (ARRAY['%filtre%', '%filter%', '%pour over%'])
    OR product_url ILIKE ANY (ARRAY['%filtre%', '%filter%', '%pour-over%'])
  );

UPDATE coffees
SET roast_level = 'medium_light'
WHERE roast_level = 'unknown'
  AND is_public = true
  AND specialty_status = 'specialty'
  AND is_available = true
  AND (
    origin_country IS NOT NULL
    OR process <> 'unknown'
    OR flavor_notes_normalized <> '{}'::text[]
  );

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
        )
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

GRANT EXECUTE ON FUNCTION get_filter_options() TO anon;
