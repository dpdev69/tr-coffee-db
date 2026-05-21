-- Seed all active roasters
-- These must exist before scrapers can run (they look up roaster_id by slug)

INSERT INTO roasters (slug, name, website_url, shop_url, city, platform) VALUES
  -- Shopify (8)
  ('petra', 'Petra Coffee', 'https://petracoffee.com', 'https://petracoffee.com', 'Istanbul', 'shopify'),
  ('montag', 'Montag Coffee Roasters', 'https://montagcoffee.com', 'https://montagcoffee.com', 'Istanbul', 'shopify'),
  ('aroasting-lab', 'A Roasting Lab', 'https://aroastinglab.com', 'https://aroastinglab.com', 'Bursa', 'shopify'),
  ('coach-coffee', 'Coach Coffee Company', 'https://coachcoffeeco.com', 'https://coachcoffeeco.com', 'Istanbul', 'shopify'),
  ('coffeenutz', 'CoffeeNutz', 'https://www.coffeenutz.net', 'https://www.coffeenutz.net', 'Izmir', 'shopify'),
  ('homestead', 'Homestead Coffee', 'https://homestead.coffee', 'https://homestead.coffee', 'Antalya', 'shopify'),
  ('nok-coffee', 'Nok Coffee', 'https://www.nokcoffee.com', 'https://www.nokcoffee.com', 'Izmir', 'shopify'),
  ('boxx', 'Boxx Coffee Roasters', 'https://boxxcoffee.com', 'https://boxxcoffee.com', 'Istanbul', 'shopify'),
  -- WooCommerce (11)
  ('baristocrat', 'Baristocrat', 'https://www.baristocrat.com', 'https://www.baristocrat.com', 'Izmir', 'woocommerce'),
  ('coffee-friendzone', 'Coffee Friendzone', 'https://coffeefriendzone.com', 'https://coffeefriendzone.com', 'Izmir', 'woocommerce'),
  ('coffeemamma', 'Coffeemamma', 'https://coffeemamma.com.tr', 'https://coffeemamma.com.tr', 'Izmir', 'woocommerce'),
  ('daphne', 'Daphne Coffee Co.', 'https://daphnecoffee.co', 'https://daphnecoffee.co', 'Ankara', 'woocommerce'),
  ('old-java', 'Old Java Coffee Roasters', 'https://oldjavacoffee.com', 'https://oldjavacoffee.com', 'Istanbul', 'woocommerce'),
  ('ordinarius', 'Ordinarius Coffee Roastery', 'https://ordinariuscoffee.com', 'https://ordinariuscoffee.com', 'Eskisehir', 'woocommerce'),
  ('parsa', 'Parsa Coffee Roasters', 'https://parsacoffeeroasters.com', 'https://parsacoffeeroasters.com', 'Istanbul', 'woocommerce'),
  ('poka', 'Poka Coffee Roasters', 'https://poka.coffee', 'https://poka.coffee', 'Izmir', 'woocommerce'),
  ('sezy', 'Sezy Coffee', 'https://sezycoffee.com', 'https://sezycoffee.com', 'Ankara', 'woocommerce'),
  ('molecule', 'Molecule Coffee', 'https://coffeemolecule.com', 'https://coffeemolecule.com', 'Istanbul', 'woocommerce'),
  ('williams', 'Williams Roastery', 'https://williamsroastery.com', 'https://williamsroastery.com', 'Istanbul', 'woocommerce'),
  -- Ikas (7) — HTML scraping, Phase 2
  ('gourme', 'Gourme Coffee', 'https://gourmecoffee.com', 'https://gourmecoffee.com', 'Istanbul', 'ikas'),
  ('hound', 'Hound Coffee', 'https://houndcoffee.com', 'https://houndcoffee.com', 'Ankara', 'ikas'),
  ('kernel', 'Kernel Coffee', 'https://kernelcoffee.co', 'https://kernelcoffee.co', 'Istanbul', 'ikas'),
  ('paper', 'Paper Coffee & Chocolate', 'https://paperroastingcoffee.com', 'https://paperroastingcoffee.com', 'Ankara', 'ikas'),
  ('story', 'Story Coffee Roasters', 'https://storyroasters.com', 'https://storyroasters.com', 'Istanbul', 'ikas'),
  ('ultra', 'Ultra Coffee Roastery', 'https://ultracoffee.myikas.com', 'https://ultracoffee.myikas.com', 'Izmit', 'ikas'),
  ('spada', 'Spada Coffee', 'https://spadacoffee.com', 'https://spadacoffee.com', 'Istanbul', 'ikas'),
  -- Ikas, currently no live product catalog
  ('caffe-di-toee', 'Caffe Di Toee', 'https://caffeditoee.com', 'https://caffeditoee.com', 'Ankara', 'ikas'),
  -- Custom platforms (future phases)
  ('kronotrop', 'Kronotrop', 'https://kronotrop.com.tr', 'https://kronotrop.com.tr', 'Istanbul', 'custom'),
  ('probador', 'Probador Colectiva', 'https://probadorcolectiva.com', 'https://probadorcolectiva.com', 'Istanbul', 'custom'),
  ('grizzly', 'Grizzly Coffee Roasters', 'https://grizzlycoffeeroasters.com', 'https://grizzlycoffeeroasters.com', 'Istanbul', 'custom')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  shop_url = EXCLUDED.shop_url,
  city = EXCLUDED.city,
  platform = EXCLUDED.platform;
