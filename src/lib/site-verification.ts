import type { Metadata } from 'next';

/**
 * Optional Google Search Console HTML-tag verification. Production is already verified through the hellobasalt.dev
 * domain property (DNS), so this is only for a URL-prefix property. Unset, blank or whitespace means no meta tag at all.
 * The variable is read by its literal name so the build can inline it.
 */
export function googleSiteVerification(token: string | undefined = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION): Metadata['verification'] | undefined {
  const google = token?.trim();
  return google ? { google } : undefined;
}
