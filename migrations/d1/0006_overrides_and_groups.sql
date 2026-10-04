-- Manual corrections survive crawls: ingestion writes coalesce(visibility_override, crawled value)
-- into visibility, so every existing visibility='public' reader honours the override.
-- Size twins ("KOYU" / "KOYU 2.5KG") point at one parent. Offers keep their own coffee_id,
-- so price history and deal evidence are untouched; only reads group them.
ALTER TABLE coffees ADD COLUMN visibility_override TEXT CHECK(visibility_override IS NULL OR visibility_override IN ('public','hidden'));
ALTER TABLE coffees ADD COLUMN canonical_coffee_id TEXT REFERENCES coffees(id);
CREATE INDEX coffees_canonical ON coffees(canonical_coffee_id) WHERE canonical_coffee_id IS NOT NULL;
-- A group is its parent plus each public child that is current by the same 7-day rule.
-- Filter by group_id; both branches seek an index.
CREATE VIEW coffee_group_members AS
 SELECT id AS group_id,id AS coffee_id FROM coffees
 UNION ALL
 SELECT m.canonical_coffee_id,m.id FROM coffees m JOIN roasters r ON r.id=m.roaster_id
 WHERE m.canonical_coffee_id IS NOT NULL AND m.visibility='public' AND m.discontinued_at IS NULL
 AND (r.last_success_at IS NULL OR datetime(m.last_seen_at)>=datetime(r.last_success_at,'-7 days'));
-- catalog_counts reads public_catalog_coffees, so both views are recreated as in 0005.
DROP VIEW IF EXISTS catalog_counts;
DROP VIEW IF EXISTS public_catalog_coffees;
CREATE VIEW public_catalog_coffees AS
 SELECT c.* FROM coffees c JOIN roasters r ON r.id=c.roaster_id
 WHERE r.active=1 AND c.visibility='public' AND c.discontinued_at IS NULL AND c.canonical_coffee_id IS NULL
 AND (r.last_success_at IS NULL OR datetime(c.last_seen_at)>=datetime(r.last_success_at,'-7 days'))
 AND EXISTS(SELECT 1 FROM coffee_group_members g JOIN offers o ON o.coffee_id=g.coffee_id WHERE g.group_id=c.id AND o.retired_at IS NULL AND o.in_stock=1);
CREATE VIEW catalog_counts AS SELECT
 (SELECT count(*) FROM public_catalog_coffees) AS coffees,
 (SELECT count(DISTINCT roaster_id) FROM public_catalog_coffees) AS roasters,
 (SELECT count(*) FROM public_catalog_coffees c JOIN coffee_group_members g ON g.group_id=c.id JOIN offers o ON o.coffee_id=g.coffee_id WHERE o.in_stock=1 AND o.retired_at IS NULL) AS offers;
