-- Absence still never writes stock state. Instead, a coffee is current only while a
-- successful crawl of its roaster saw it within 7 days of that roaster's latest success.
-- Failed/partial runs never move last_success_at, so an outage never hides a catalog.
-- catalog_counts reads public_catalog_coffees, so both views are recreated.
DROP VIEW IF EXISTS catalog_counts;
DROP VIEW IF EXISTS public_catalog_coffees;
CREATE VIEW public_catalog_coffees AS
 SELECT c.* FROM coffees c JOIN roasters r ON r.id=c.roaster_id
 WHERE r.active=1 AND c.visibility='public' AND c.discontinued_at IS NULL
 AND (r.last_success_at IS NULL OR datetime(c.last_seen_at)>=datetime(r.last_success_at,'-7 days'))
 AND EXISTS(SELECT 1 FROM offers o WHERE o.coffee_id=c.id AND o.retired_at IS NULL AND o.in_stock=1);
CREATE VIEW catalog_counts AS SELECT
 (SELECT count(*) FROM public_catalog_coffees) AS coffees,
 (SELECT count(DISTINCT roaster_id) FROM public_catalog_coffees) AS roasters,
 (SELECT count(*) FROM offers o JOIN public_catalog_coffees c ON c.id=o.coffee_id WHERE o.in_stock=1 AND o.retired_at IS NULL) AS offers;
