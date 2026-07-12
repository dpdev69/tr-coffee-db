-- Cover every journey-model foreign key used for joins and referential actions.

CREATE INDEX IF NOT EXISTS idx_coffee_assessments_coffee
  ON coffee_assessments(coffee_id)
  WHERE coffee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coffee_assessments_source
  ON coffee_assessments(source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coffee_certifications_organization
  ON coffee_certifications(organization_id)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coffee_certifications_source
  ON coffee_certifications(source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_coffee_claims_source
  ON coffee_claims(source_id)
  WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trace_events_source
  ON trace_events(source_id)
  WHERE source_id IS NOT NULL;
