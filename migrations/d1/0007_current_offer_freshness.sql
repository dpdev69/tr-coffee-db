-- An offer is current only while a successful crawl of its roaster validated it within 7 days
-- of that roaster's latest success (the 0005 coffee rule, per offer). Ingestion writes
-- offers.last_seen_at only for validated observations, so an offer skipped every night ages out
-- here instead of showing its last price forever. Nothing is retired or rewritten: the next valid
-- observation makes it current again, and price_observations are untouched.
-- Every reader of current offers goes through this view; the views that read offers are recreated.
DROP VIEW IF EXISTS catalog_counts;
DROP VIEW IF EXISTS public_catalog_coffees;
DROP VIEW IF EXISTS current_offers;
CREATE VIEW current_offers AS
 SELECT o.* FROM offers o JOIN coffees c ON c.id=o.coffee_id JOIN roasters r ON r.id=c.roaster_id
 WHERE o.retired_at IS NULL
 AND (r.last_success_at IS NULL OR datetime(o.last_seen_at)>=datetime(r.last_success_at,'-7 days'));
CREATE VIEW public_catalog_coffees AS
 SELECT c.* FROM coffees c JOIN roasters r ON r.id=c.roaster_id
 WHERE r.active=1 AND c.visibility='public' AND c.discontinued_at IS NULL AND c.canonical_coffee_id IS NULL
 AND (r.last_success_at IS NULL OR datetime(c.last_seen_at)>=datetime(r.last_success_at,'-7 days'))
 AND EXISTS(SELECT 1 FROM coffee_group_members g JOIN current_offers o ON o.coffee_id=g.coffee_id WHERE g.group_id=c.id AND o.in_stock=1);
CREATE VIEW catalog_counts AS SELECT
 (SELECT count(*) FROM public_catalog_coffees) AS coffees,
 (SELECT count(DISTINCT roaster_id) FROM public_catalog_coffees) AS roasters,
 (SELECT count(*) FROM public_catalog_coffees c JOIN coffee_group_members g ON g.group_id=c.id JOIN current_offers o ON o.coffee_id=g.coffee_id WHERE o.in_stock=1) AS offers;
