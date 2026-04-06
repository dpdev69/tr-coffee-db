-- Remove Coffee Sapiens from the active supported cohort.
UPDATE roasters
SET is_active = false
WHERE slug = 'coffee-sapiens';
