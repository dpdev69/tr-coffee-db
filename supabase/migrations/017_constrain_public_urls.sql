-- Keep public navigation and image URLs on browser-safe schemes.

ALTER TABLE coffees
  DROP CONSTRAINT IF EXISTS coffees_product_url_http_check;

ALTER TABLE coffees
  ADD CONSTRAINT coffees_product_url_http_check CHECK (
    product_url ~* '^https?://[^/?#[:space:]@]+'
    AND product_url !~ '[[:space:]]'
    AND product_url !~* '^https?://[^/?#]*@'
  );

ALTER TABLE coffees
  DROP CONSTRAINT IF EXISTS coffees_image_url_http_check;

ALTER TABLE coffees
  ADD CONSTRAINT coffees_image_url_http_check CHECK (
    image_url IS NULL
    OR (
      image_url ~* '^https?://[^/?#[:space:]@]+'
      AND image_url !~ '[[:space:]]'
      AND image_url !~* '^https?://[^/?#]*@'
    )
  );
