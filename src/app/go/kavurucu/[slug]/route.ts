import { brand } from '@/lib/brand';
import { getV2Environment } from '@/lib/v2-runtime';
import { handleRoasterOutbound } from '../../../../../shared/v2/outbound';
import { OUTAGE_ONLY_HEADERS } from '../../../../../shared/v2/read-cache';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const response = await handleRoasterOutbound(request, (await params).slug, (await getV2Environment()).DB, brand.analyticsSource);
    if (response.status === 302) for (const [name, value] of Object.entries(OUTAGE_ONLY_HEADERS)) response.headers.set(name, value);
    return response;
  }
  catch { return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } }); }
}
export const HEAD = GET;
