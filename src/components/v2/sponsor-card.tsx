/** Explicitly off until a real sponsor and placement are approved. Never used by catalog sorting, quiz ranking or the issue's automated lists. */
export function sponsorshipsEnabled(): boolean {
  // Read per call so the email script and tests see the current value.
  return process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED === 'true';
}
export interface Sponsor { name: string; description: string; link: string; host: string }
export const SPONSOR_LABEL = 'Sponsorlu';
export const SPONSOR_DISCLOSURE = 'Bu bölüm için ödeme alındı. Bültendeki seçimler sponsorluktan bağımsızdır.';

/** The sponsor link only when it is https on exactly the host the issue file names, with no credentials or port. */
export function trustedSponsorUrl(sponsor: Sponsor): URL | null {
  let url: URL;
  try { url = new URL(sponsor.link); } catch { return null; }
  return url.protocol === 'https:' && url.hostname === sponsor.host.trim().toLowerCase() && !url.username && !url.password && !url.port ? url : null;
}

/** `tag` adds the campaign tags so the sponsor sees the visits in their own analytics. */
export function SponsorCard({ sponsor, tag = url => url.toString() }: { sponsor?: Sponsor; tag?: (url: URL) => string }) {
  const destination = sponsor && sponsorshipsEnabled() ? trustedSponsorUrl(sponsor) : null;
  if (!sponsor || !destination) return null;
  return <aside aria-label="Sponsorlu içerik" className="mt-12 rounded-[14px] border border-line bg-surface p-6">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{SPONSOR_LABEL}</p>
    <p className="mt-1 text-xs text-muted">{SPONSOR_DISCLOSURE}</p>
    <h2 className="mt-3 font-display text-[22px]">{sponsor.name}</h2>
    <p className="mt-2 text-[15px] leading-relaxed">{sponsor.description}</p>
    <a href={tag(destination)} rel="sponsored nofollow noopener" className="text-link mt-2 inline-flex min-h-11 items-center">Sponsorun sitesine git →</a>
  </aside>;
}
