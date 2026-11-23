import { SAVED_KEY } from '@/lib/device-keys';
import { savedListFlagScript } from '@/lib/saved-list-flag';

/** Runs before paint: a stored list reserves the Listem panel's cell, so the page does not jump when it hydrates.
 * Must stay an inline script (a client effect would flash); the Worker stamps the CSP nonce onto it (workers/edge-headers.ts). */
export function SavedListFlag() {
  return <script dangerouslySetInnerHTML={{ __html: savedListFlagScript(SAVED_KEY) }} />;
}
