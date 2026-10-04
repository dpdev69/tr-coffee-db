export const CONSENT_COOKIE = 'kahvedrop_consent';
export type ConsentChoice = 'essential' | 'analytics';
export function consentChoice(cookie: string | null | undefined): ConsentChoice | null {
  const value = cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${CONSENT_COOKIE}=`))?.slice(CONSENT_COOKIE.length + 1);
  return value === 'analytics' || value === 'essential' ? value : null;
}
export function analyticsConsent(cookie: string | null | undefined): boolean { return consentChoice(cookie) === 'analytics'; }
