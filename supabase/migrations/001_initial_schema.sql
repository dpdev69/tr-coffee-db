-- TR Coffee DB — Initial Schema
-- Creates roasters, coffees, and scrape_logs tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- ROASTERS
-- ==========================================
CREATE TABLE roasters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  shop_url TEXT NOT NULL,
  logo_url TEXT,
  city TEXT,
  description TEXT,
  platform TEXT NOT NULL, -- shopify, woocommerce, ikas, ticimax, custom
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- COFFEES
-- ==========================================
CREATE TABLE coffees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roaster_id UUID NOT NULL REFERENCES roasters(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  external_id TEXT NOT NULL,

  -- Names
  name TEXT NOT NULL,
  name_normalized TEXT,

  -- Origin
  origin_country TEXT,
  origin_region TEXT,
  origin_farm TEXT,
  origin_altitude TEXT,
  origin_producer TEXT,

  -- Processing
  process TEXT DEFAULT 'unknown',
  process_detail TEXT,

  -- Characteristics
  roast_level TEXT DEFAULT 'unknown',
  variety TEXT,
  flavor_notes TEXT[] DEFAULT '{}',
  flavor_notes_normalized TEXT[] DEFAULT '{}',
  flavor_categories TEXT[] DEFAULT '{}',
  sca_score NUMERIC(4,1),

  -- Pricing (all normalized to TRY)
  price_amount NUMERIC(10,2),
  price_currency TEXT DEFAULT 'TRY',
  weight_grams INTEGER,
  price_per_100g NUMERIC(10,2),

  -- Links
  product_url TEXT NOT NULL,
  image_url TEXT,

  -- Status
  is_available BOOLEAN DEFAULT true,
  is_decaf BOOLEAN DEFAULT false,
  brew_methods TEXT[] DEFAULT '{}',

  -- Tracking
  click_count INTEGER DEFAULT 0,
  last_scraped_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint for upsert
  UNIQUE (roaster_id, external_id)
);

-- ==========================================
-- SCRAPE LOGS
-- ==========================================
CREATE TABLE scrape_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roaster_id UUID REFERENCES roasters(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL, -- success, failed
  products_found INTEGER DEFAULT 0,
  products_upserted INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- AUTO-UPDATE updated_at TRIGGER
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roasters_updated_at
  BEFORE UPDATE ON roasters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER coffees_updated_at
  BEFORE UPDATE ON coffees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
