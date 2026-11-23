import { analyticsConsent } from '@shared/v2/consent';
import { getV2Environment } from '@/lib/v2-runtime';
import { analyticsResponse, handleProductEvent } from '@shared/v2/analytics';
import { logRouteError } from '@/lib/log-error';

export async function POST(request: Request) {
  if (!analyticsConsent(request.headers.get('cookie'))) return analyticsResponse(204);
  try { const env = await getV2Environment(); return await handleProductEvent(request, env, env.DB); }
  catch (error) { logRouteError('/api/events', error); return analyticsResponse(503); }
}
