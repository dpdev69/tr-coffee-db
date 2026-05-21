-- Keep the public supported-roaster cohort aligned with live first-party sources.
-- These roasters remain tracked in research, but they do not currently expose a
-- reliable first-party catalog for launch-quality scraping.

UPDATE roasters
SET
  website_url = 'https://ultracoffee.myikas.com',
  shop_url = 'https://ultracoffee.myikas.com',
  platform = 'ikas',
  is_active = false
WHERE slug = 'ultra';

UPDATE roasters
SET
  website_url = 'https://caffeditoee.com',
  shop_url = 'https://caffeditoee.com',
  platform = 'ikas',
  is_active = false
WHERE slug = 'caffe-di-toee';

UPDATE roasters
SET is_active = false
WHERE slug = 'grizzly';
