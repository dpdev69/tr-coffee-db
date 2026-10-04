import { permanentRedirect } from 'next/navigation';

/** Retired scoring destination: existing bookmarks continue to coffee discovery. */
export default function RankingsPage() {
  permanentRedirect('/kahveler');
}
