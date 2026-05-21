import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const imageHosts = [
  "a4kahve.com",
  "aroastinglab.com",
  "boxxcoffee.com",
  "caffeditoee.com",
  "cdn.shopify.com",
  "coachcoffeeco.com",
  "coffeecalibre.com",
  "coffeedepartment.co",
  "coffeefriendzone.com",
  "coffeemamma.com.tr",
  "coffeemolecule.com",
  "coffeerem.com",
  "cupofjoy.com.tr",
  "daphnecoffee.co",
  "gourmecoffee.com",
  "grizzlycoffeeroasters.com",
  "homestead.coffee",
  "houndcoffee.com",
  "kernelcoffee.co",
  "kimmacoffee.com",
  "kronotrop.com.tr",
  "media.kafeinkultur.com",
  "montagcoffee.com",
  "nokcoffee.com",
  "null.coffee",
  "oldjavacoffee.com",
  "ordinariuscoffee.com",
  "orkunustel.com",
  "paperroastingcoffee.com",
  "parsacoffeeroasters.com",
  "petracoffee.com",
  "poka.coffee",
  "probadorcolectiva.com",
  "rorcafe.com.tr",
  "schillerturkiye.com",
  "sezycoffee.com",
  "shop.kimmacoffee.com",
  "spadacoffee.com",
  "static.ticimax.cloud",
  "storyroasters.com",
  "tetranroastery.com",
  "ultracoffee.myikas.com",
  "williamsroastery.com",
  "www.baristocrat.com",
  "www.coffeenutz.net",
  "www.coffeesapiens.com",
  "www.kafeinkultur.com",
  "www.kronotrop.com.tr",
  "www.nokcoffee.com",
] as const;

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://va.vercel-scripts.com https://*.vercel-insights.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
].join("; ");

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
    ];
  },
  images: {
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: "https" as const,
      hostname,
      pathname: "/**",
    })),
  },
};

export default nextConfig;
