import { ConsentedBeacon } from './consent-controls';
import { headers } from 'next/headers';
import { getV2Environment } from '@/lib/v2-runtime';

/** Separate hostname-specific Cloudflare site keeps local development out of traffic metrics. */
export async function WebAnalytics() {
  let token: string | undefined;
  try {
    const env = await getV2Environment();
    const host = (await headers()).get('host');
    if (host === env.WEB_ANALYTICS_HOST) token = env.WEB_ANALYTICS_TOKEN;
  } catch { return null; }
  if (!token || !/^[a-f0-9]{32}$/.test(token)) return null;
  return <ConsentedBeacon token={token} />;
}
