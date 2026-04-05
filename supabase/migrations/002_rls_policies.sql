-- Row Level Security policies
-- Public (anon) can SELECT; only service_role can INSERT/UPDATE/DELETE

ALTER TABLE roasters ENABLE ROW LEVEL SECURITY;
ALTER TABLE coffees ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public can read roasters"
  ON roasters FOR SELECT
  USING (true);

CREATE POLICY "Public can read coffees"
  ON coffees FOR SELECT
  USING (true);

-- Service role full access (scrapers)
CREATE POLICY "Service role manages roasters"
  ON roasters FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages coffees"
  ON coffees FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages scrape_logs"
  ON scrape_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
