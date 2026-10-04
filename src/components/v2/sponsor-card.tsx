/** Explicitly off until a real sponsor and placement are approved. Never used by catalog sorting. */
const sponsorshipEnabled = process.env.NEXT_PUBLIC_SPONSORSHIPS_ENABLED === 'true';
export interface SponsorPlacement { name: string; description: string; href: string; trustedHost: string }
export function SponsorCard({ sponsor }: { sponsor?: SponsorPlacement }) {
  if (!sponsorshipEnabled || !sponsor) return null;
  let destination: URL;
  try { destination = new URL(sponsor.href); } catch { return null; }
  if (destination.protocol !== 'https:' || destination.hostname !== sponsor.trustedHost || destination.username || destination.password || destination.port) return null;
  return <aside aria-label="Sponsorlu içerik" className="my-6 rounded-2xl border border-[#dedfd7] bg-[#f0f1e9] p-5 lg:max-w-sm">
    <p className="text-xs font-semibold uppercase tracking-widest text-[#625e57]">Sponsorlu</p>
    <h2 className="mt-3 font-display text-2xl text-[#244b3d]">{sponsor.name}</h2>
    <p className="mt-2 text-sm leading-6 text-[#625e57]">{sponsor.description}</p>
    <a href={destination.toString()} rel="sponsored nofollow" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4">İncele ↗</a>
  </aside>;
}
