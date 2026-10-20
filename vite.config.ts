import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import { streamedIconKeyWithoutPath } from "./vite-streamed-icons";

export default defineConfig({
  plugins: [
    // Icon markers must not look like page addresses to crawlers (vite-streamed-icons.ts).
    streamedIconKeyWithoutPath(),
    vinext({
      cache: { cdn: cdnAdapter() },
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      // Production builds name wrangler.production.jsonc; unset means the default staging wrangler.jsonc.
      ...(process.env.WRANGLER_CONFIG ? { configPath: process.env.WRANGLER_CONFIG } : {}),
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
