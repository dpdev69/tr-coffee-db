-- Add roasters surfaced by first live user feedback.
-- Milestones and Cho Coffee Roastery both expose packaged-bean catalogs.

INSERT INTO roasters (
  slug,
  name,
  website_url,
  shop_url,
  city,
  platform,
  is_active,
  support_tier
) VALUES
  (
    'milestones',
    'Milestones Coffee',
    'https://milestonescoffee.com',
    'https://milestonescoffee.com/kategori/kahveler-57/',
    'Manisa',
    'custom',
    true,
    'supported'
  ),
  (
    'cho-coffee',
    'Cho Coffee Roastery',
    'https://chocoffeeroastery.com',
    'https://chocoffeeroastery.com/tr/kahve',
    'Istanbul',
    'custom',
    true,
    'supported'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  shop_url = EXCLUDED.shop_url,
  city = EXCLUDED.city,
  platform = EXCLUDED.platform,
  is_active = EXCLUDED.is_active,
  support_tier = EXCLUDED.support_tier;
