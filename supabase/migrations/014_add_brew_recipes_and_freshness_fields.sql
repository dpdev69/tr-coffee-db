ALTER TABLE coffees
  ADD COLUMN IF NOT EXISTS harvest_year TEXT,
  ADD COLUMN IF NOT EXISTS roast_date TEXT,
  ADD COLUMN IF NOT EXISTS brew_recipes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_coffees_current_availability
  ON coffees (is_available, last_seen_at DESC);
