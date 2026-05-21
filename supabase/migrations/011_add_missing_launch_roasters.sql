-- Add launch-gap roasters identified in the Turkish specialty coffee review.
-- KafeinKültür and Coffeerem are Woo-like/custom storefronts, so they are
-- tracked as custom sources and scraped from their public catalog HTML.

INSERT INTO roasters (slug, name, website_url, shop_url, city, platform, is_active) VALUES
  ('kafeinkultur', 'KafeinKültür', 'https://www.kafeinkultur.com', 'https://www.kafeinkultur.com/kafeinkultur', 'Istanbul', 'custom', true),
  ('orkun-ustel', 'Orkun Üstel', 'https://orkunustel.com', 'https://orkunustel.com/nitelikli-kahve', 'Istanbul', 'ikas', true),
  ('coffeerem', 'Coffeerem Roastery', 'https://coffeerem.com', 'https://coffeerem.com/magaza/', 'Izmir', 'custom', true),
  ('null-coffee', 'Null Coffee Roasters', 'https://null.coffee', 'https://null.coffee', 'Istanbul', 'shopify', true),
  ('kimma', 'Kimma Coffee Roasters', 'https://kimmacoffee.com', 'https://shop.kimmacoffee.com', 'Istanbul', 'shopify', true),
  ('coffee-department', 'Coffee Department', 'https://coffeedepartment.co', 'https://coffeedepartment.co/kahveler', 'Istanbul', 'custom', true),
  ('cup-of-joy', 'Cup of Joy', 'https://cupofjoy.com.tr', 'https://cupofjoy.com.tr', 'Istanbul', 'shopify', true),
  ('calibre', 'Calibre Coffee', 'https://coffeecalibre.com', 'https://coffeecalibre.com', 'Istanbul', 'ikas', true),
  ('a4-kahve', 'A4 Kahve', 'https://a4kahve.com', 'https://a4kahve.com', NULL, 'ikas', true),
  ('tetra-n', 'Tetra N Roastery', 'https://tetranroastery.com', 'https://tetranroastery.com', 'Ankara', 'ikas', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  website_url = EXCLUDED.website_url,
  shop_url = EXCLUDED.shop_url,
  city = EXCLUDED.city,
  platform = EXCLUDED.platform,
  is_active = EXCLUDED.is_active;
