'use client';

import { analyticsConsent } from '../../shared/v2/consent';
import type { ClientProductEvent } from '../../shared/v2/analytics';

/** No identifiers are stored in the browser, and event fields never contain form values. */
export function trackProductEvent(event: ClientProductEvent): void {
  if (typeof document === 'undefined' || !analyticsConsent(document.cookie)) return;
  const body = JSON.stringify(event);
  // A native GET form unloads the page; Beacon keeps its anonymous event queued through navigation.
  try {
    if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }))) return;
  } catch { /* Fall back to keepalive when Beacon is unavailable. */ }
  void fetch('/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body, keepalive: true, credentials: 'same-origin',
  }).catch(() => { /* Measurement must never interrupt discovery. */ });
}
