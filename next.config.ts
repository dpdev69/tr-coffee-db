import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Shopify CDN (most roaster product images)
      { protocol: "https", hostname: "cdn.shopify.com" },
      // WooCommerce sites serve images from their own domains
      { protocol: "https", hostname: "*.com" },
      { protocol: "https", hostname: "*.com.tr" },
      { protocol: "https", hostname: "*.coffee" },
      { protocol: "https", hostname: "*.co" },
      { protocol: "https", hostname: "*.net" },
      { protocol: "https", hostname: "*.cloud" },
      { protocol: "https", hostname: "percdn.com" },
    ],
  },
};

export default nextConfig;
