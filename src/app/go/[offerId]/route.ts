import { analyticsConsent } from '../../../../shared/v2/consent';
import { brand } from '@/lib/brand';
import { getV2Environment } from '@/lib/v2-runtime';
import { handleOutbound } from '../../../../shared/v2/outbound';
import { OUTAGE_ONLY_HEADERS } from '../../../../shared/v2/read-cache';

export async function GET(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  try {
    const env = await getV2Environment();
    const response = await handleOutbound(request, (await params).offerId, env.DB, { ...env, ANALYTICS: analyticsConsent(request.headers.get('cookie')) ? env.ANALYTICS : undefined }, brand.analyticsSource);
    if (response.status === 302) for (const [name, value] of Object.entries(OUTAGE_ONLY_HEADERS)) response.headers.set(name, value);
    return response;
  } catch { return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } }); }
}
export const HEAD = GET;
