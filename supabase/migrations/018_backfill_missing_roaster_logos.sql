-- Populate logo URLs for active roasters added after the initial logo backfill.

UPDATE roasters AS r
SET logo_url = v.logo_url
FROM (
  VALUES
    ('cho-coffee', '/roaster-logos/cho-coffee.jpeg'),
    ('milestones', '/roaster-logos/milestones.png'),
    ('williams', '/roaster-logos/williams.png')
) AS v(slug, logo_url)
WHERE r.slug = v.slug;
