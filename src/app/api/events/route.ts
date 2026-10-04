import { analyticsConsent } from '../../../../shared/v2/consent';
import { getV2Environment } from '@/lib/v2-runtime';
import { analyticsResponse, handleProductEvent } from '../../../../shared/v2/analytics';

export async function POST(request: Request) {
  if (!analyticsConsent(request.headers.get('cookie'))) return analyticsResponse(204);
  try { const env = await getV2Environment(); return await handleProductEvent(request, env, env.DB); }
  catch { return analyticsResponse(503); }
}
