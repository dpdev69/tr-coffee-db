-- Performance indexes for filtering, sorting, and search

-- Coffees: common filter columns
CREATE INDEX IF NOT EXISTS idx_coffees_roaster ON coffees(roaster_id);
CREATE INDEX IF NOT EXISTS idx_coffees_origin ON coffees(origin_country);
CREATE INDEX IF NOT EXISTS idx_coffees_process ON coffees(process);
CREATE INDEX IF NOT EXISTS idx_coffees_roast ON coffees(roast_level);
CREATE INDEX IF NOT EXISTS idx_coffees_price ON coffees(price_amount);
CREATE INDEX IF NOT EXISTS idx_coffees_price_100g ON coffees(price_per_100g);
CREATE INDEX IF NOT EXISTS idx_coffees_available ON coffees(is_available);
CREATE INDEX IF NOT EXISTS idx_coffees_slug ON coffees(slug);
CREATE INDEX IF NOT EXISTS idx_coffees_decaf ON coffees(is_decaf) WHERE is_decaf = true;

-- GIN indexes for array columns (filter by any element)
CREATE INDEX IF NOT EXISTS idx_coffees_flavor_cats ON coffees USING GIN(flavor_categories);
CREATE INDEX IF NOT EXISTS idx_coffees_brew_methods ON coffees USING GIN(brew_methods);
CREATE INDEX IF NOT EXISTS idx_coffees_flavor_notes ON coffees USING GIN(flavor_notes_normalized);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_coffees_fts ON coffees USING GIN(
  to_tsvector('simple',
    coalesce(name, '') || ' ' ||
    coalesce(name_normalized, '') || ' ' ||
    coalesce(origin_country, '') || ' ' ||
    coalesce(origin_region, '') || ' ' ||
    coalesce(variety, '') || ' ' ||
    coalesce(process, '')
  )
);

-- Scrape logs: recent lookups
CREATE INDEX IF NOT EXISTS idx_scrape_logs_roaster ON scrape_logs(roaster_id, started_at DESC);

-- Roasters
CREATE INDEX IF NOT EXISTS idx_roasters_active ON roasters(is_active) WHERE is_active = true;
