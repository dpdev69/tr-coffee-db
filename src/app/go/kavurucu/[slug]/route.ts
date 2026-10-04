import { brand } from '@/lib/brand';
import { getV2Environment } from '@/lib/v2-runtime';
import { handleRoasterOutbound } from '../../../../../shared/v2/outbound';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try { return await handleRoasterOutbound(request, (await params).slug, (await getV2Environment()).DB, brand.analyticsSource); }
  catch { return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } }); }
}
export const HEAD = GET;
