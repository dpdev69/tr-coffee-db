import { imageHosts } from './shared/v2/image-hosts';
import { contentSecurityPolicy as buildContentSecurityPolicy } from './shared/v2/content-security-policy';
import { EDGE_CACHE_CONTROL } from './shared/v2/read-cache';
import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

// HTML responses get this policy with a fresh nonce from the Worker gateway (workers/edge-headers.ts).
const contentSecurityPolicy = buildContentSecurityPolicy({ development: isDevelopment });

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      // Catalog pages are the same for every visitor (personal state lives in the browser) and change once a night, so the
      // edge keeps each address, query string included, for EDGE_CACHE_CONTROL. This also covers query-string pages, which
      // vinext would otherwise send as no-store. A render that failed to read the catalog opts out (keepOutOfEdgeCache).
      ...["/", "/kahveler", "/kahveler/:facet/:slug", "/yeni", "/firsatlar", "/quiz/sonuc", "/kahve/:slug", "/kavurucu/:slug", "/kavurucular", "/bulten/:month", "/karsilastir", "/karsilastir/:pair", "/rehber/:guide", "/veri"]
        .map((source) => ({ source, headers: [{ key: "CDN-Cache-Control", value: EDGE_CACHE_CONTROL }] })),
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    // Next caps this at 50. Ordinarius photos use www; the product proxy accepts both exact hosts.
    remotePatterns: imageHosts.filter((hostname) => hostname !== 'ordinariuscoffee.com').map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    })),
  },
};

export default nextConfig;
