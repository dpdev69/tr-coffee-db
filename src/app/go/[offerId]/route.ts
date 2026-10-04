import { analyticsConsent } from '../../../../shared/v2/consent';
import { brand } from '@/lib/brand';
import { getV2Environment } from '@/lib/v2-runtime';
import { handleOutbound } from '../../../../shared/v2/outbound';

export async function GET(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  try {
    const env = await getV2Environment();
    return await handleOutbound(request, (await params).offerId, env.DB, { ...env, ANALYTICS: analyticsConsent(request.headers.get('cookie')) ? env.ANALYTICS : undefined }, brand.analyticsSource);
  } catch { return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } }); }
}
export const HEAD = GET;
