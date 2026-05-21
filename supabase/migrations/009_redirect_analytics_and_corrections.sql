-- Privacy-light redirect analytics and correction intake.
-- These tables intentionally do not store IPs, user IDs, session IDs, payment data,
-- or raw user-agent strings.

CREATE TABLE IF NOT EXISTS redirect_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coffee_id UUID NOT NULL REFERENCES coffees(id) ON DELETE CASCADE,
  roaster_id UUID NOT NULL REFERENCES roasters(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  filter_context JSONB,
  quiz_context JSONB,
  page_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT redirect_events_source_check CHECK (
    source IN (
      'coffee_detail',
      'catalog_card',
      'quiz_result',
      'seo_page',
      'roaster_page'
    )
  ),
  CONSTRAINT redirect_events_filter_context_object_check CHECK (
    filter_context IS NULL OR jsonb_typeof(filter_context) = 'object'
  ),
  CONSTRAINT redirect_events_quiz_context_object_check CHECK (
    quiz_context IS NULL OR jsonb_typeof(quiz_context) = 'object'
  ),
  CONSTRAINT redirect_events_page_path_check CHECK (
    length(page_path) BETWEEN 1 AND 160
    AND page_path !~ '[?#]'
    AND (
      page_path ~ '^/$'
      OR page_path ~ '^/coffees/?$'
      OR page_path ~ '^/coffees/[a-z0-9-]+/?$'
      OR page_path ~ '^/roasters/?$'
      OR page_path ~ '^/roasters/[a-z0-9-]+/?$'
      OR page_path ~ '^/quiz/?$'
    )
  )
);

CREATE TABLE IF NOT EXISTS correction_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coffee_id UUID REFERENCES coffees(id) ON DELETE SET NULL,
  roaster_id UUID REFERENCES roasters(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL,
  reporter_email TEXT NOT NULL,
  message TEXT NOT NULL,
  source_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT correction_reports_issue_type_check CHECK (
    issue_type IN (
      'stale_price',
      'broken_link',
      'unavailable_product',
      'wrong_metadata',
      'missing_product',
      'other'
    )
  ),
  CONSTRAINT correction_reports_reporter_email_length_check CHECK (
    length(reporter_email) BETWEEN 3 AND 254
  ),
  CONSTRAINT correction_reports_message_length_check CHECK (
    length(message) BETWEEN 1 AND 2000
  ),
  CONSTRAINT correction_reports_source_path_check CHECK (
    length(source_path) BETWEEN 1 AND 160
    AND source_path !~ '[?#]'
    AND (
      source_path ~ '^/$'
      OR source_path ~ '^/coffees/?$'
      OR source_path ~ '^/coffees/[a-z0-9-]+/?$'
      OR source_path ~ '^/roasters/?$'
      OR source_path ~ '^/roasters/[a-z0-9-]+/?$'
      OR source_path ~ '^/quiz/?$'
    )
  ),
  CONSTRAINT correction_reports_status_check CHECK (
    status IN ('new', 'reviewing', 'resolved', 'dismissed')
  )
);

DROP TRIGGER IF EXISTS correction_reports_updated_at ON correction_reports;

CREATE TRIGGER correction_reports_updated_at
  BEFORE UPDATE ON correction_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE redirect_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE correction_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages redirect events" ON redirect_events;
CREATE POLICY "Service role manages redirect events"
  ON redirect_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages correction reports" ON correction_reports;
CREATE POLICY "Service role manages correction reports"
  ON correction_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE redirect_events FROM PUBLIC;
REVOKE ALL ON TABLE redirect_events FROM anon;
REVOKE ALL ON TABLE redirect_events FROM authenticated;
GRANT ALL ON TABLE redirect_events TO service_role;

REVOKE ALL ON TABLE correction_reports FROM PUBLIC;
REVOKE ALL ON TABLE correction_reports FROM anon;
REVOKE ALL ON TABLE correction_reports FROM authenticated;
GRANT ALL ON TABLE correction_reports TO service_role;

CREATE INDEX IF NOT EXISTS idx_redirect_events_created_at
  ON redirect_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redirect_events_coffee_created
  ON redirect_events(coffee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_redirect_events_roaster_created
  ON redirect_events(roaster_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_correction_reports_status_created
  ON correction_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_correction_reports_coffee_created
  ON correction_reports(coffee_id, created_at DESC)
  WHERE coffee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_correction_reports_roaster_created
  ON correction_reports(roaster_id, created_at DESC)
  WHERE roaster_id IS NOT NULL;
