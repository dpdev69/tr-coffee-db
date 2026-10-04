import { ConsentedBeacon } from './consent-controls';
import { getV2Environment } from '@/lib/v2-runtime';

/** Separate hostname-specific Cloudflare site keeps local development out of traffic metrics.
 * The host check runs in the browser so this component does not read request headers (that would make every page dynamic). */
export async function WebAnalytics() {
  let token: string | undefined;
  let host: string | undefined;
  try {
    const env = await getV2Environment();
    token = env.WEB_ANALYTICS_TOKEN;
    host = env.WEB_ANALYTICS_HOST;
  } catch { return null; }
  if (!host || !token || !/^[a-f0-9]{32}$/.test(token)) return null;
  return <ConsentedBeacon token={token} host={host} />;
}
