-- Exercise scraper INSERT/UPDATE as its actual database role. All fixture and
-- journey writes roll back, so this also works as a hosted-database smoke test.
BEGIN;
SET LOCAL ROLE service_role;
SET LOCAL search_path = public;

DO $$
DECLARE
  fixture_roaster_id uuid := gen_random_uuid();
  fixture_coffee_id uuid := gen_random_uuid();
  actual_lot_id uuid;
  expected_lot_id uuid;
  expected_source_id uuid;
BEGIN
  INSERT INTO public.roasters (id, slug, name, website_url, shop_url, platform)
  VALUES (
    fixture_roaster_id, 'journey-test-' || fixture_roaster_id::text,
    'Journey regression fixture', 'https://example.com', 'https://example.com', 'custom'
  );

  INSERT INTO public.coffees (
    id, roaster_id, external_id, slug, name, product_url,
    origin_country, process, last_seen_at, is_public
  ) VALUES (
    fixture_coffee_id, fixture_roaster_id, fixture_coffee_id::text,
    'journey-test-' || fixture_coffee_id::text, 'Journey regression fixture',
    'https://example.com/coffee', 'Colombia', 'washed', now(), false
  );

  expected_lot_id := extensions.uuid_generate_v5(
    extensions.uuid_ns_url(), 'https://trcoffeedb.com/lots/' || fixture_coffee_id::text
  );
  expected_source_id := extensions.uuid_generate_v5(
    extensions.uuid_ns_url(), 'https://trcoffeedb.com/sources/product/' || fixture_coffee_id::text
  );

  SELECT green_lot_id INTO actual_lot_id FROM public.coffees WHERE id = fixture_coffee_id;
  IF actual_lot_id IS DISTINCT FROM expected_lot_id THEN
    RAISE EXCEPTION 'Scraper insert did not attach its deterministic coffee lot';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trace_sources
    WHERE id = expected_source_id AND lot_id = actual_lot_id AND coffee_id = fixture_coffee_id
  ) THEN
    RAISE EXCEPTION 'Scraper insert did not synchronize its product-page source';
  END IF;

  UPDATE public.coffees SET origin_country = 'Kenya', last_seen_at = now()
  WHERE id = fixture_coffee_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.coffee_lots WHERE id = expected_lot_id AND origin_country = 'Kenya'
  ) THEN
    RAISE EXCEPTION 'Scraper update did not refresh the existing lot';
  END IF;
  IF (SELECT count(*) FROM public.trace_sources WHERE coffee_id = fixture_coffee_id) <> 1 THEN
    RAISE EXCEPTION 'Scraper update duplicated its source';
  END IF;
END;
$$;

ROLLBACK;
