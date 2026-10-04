import { analyticsConsent } from '../../../../shared/v2/consent';
import { getV2Environment } from '@/lib/v2-runtime';
import { handleSubscribe, subscribeResponse, subscribeUnavailable } from '@/lib/v2-subscribe';

export async function POST(request: Request) {
  try {
    const env = await getV2Environment();
    const result = await handleSubscribe(request, { ...env, ANALYTICS: analyticsConsent(request.headers.get('cookie')) ? env.ANALYTICS : undefined });
    if (result.diagnostic) console.warn('subscribe_provider_failure', result.diagnostic);
    if (result.consentFieldsSkipped) console.warn('subscribe_consent_fields_missing');
    return subscribeResponse(result);
  } catch {
    return subscribeResponse(subscribeUnavailable());
  }
}
