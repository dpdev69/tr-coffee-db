'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { trackProductEvent } from '@/lib/product-events';
import type { AnalyticsPage, ClientProductEvent } from '../../../shared/v2/analytics';

export function DetailViewTracker({ coffeeId }: { coffeeId: string }) {
  const lastCoffee = useRef<string | null>(null);
  useEffect(() => {
    if (lastCoffee.current === coffeeId) return;
    lastCoffee.current = coffeeId;
    trackProductEvent({ event: 'coffee_detail_view', page: 'coffee', source: 'detail', coffeeId });
  }, [coffeeId]);
  return null;
}

const FILTER_KEYS = new Set(['origin', 'process', 'taste', 'roaster', 'priceMin', 'priceMax', 'search', 'farm', 'producer', 'variety', 'altitude', 'traceability', 'roast', 'brewMethod', 'sort']);
export function TrackedFilterForm({ action, children, className, page }: { action: string; children: ReactNode; className: string; page: AnalyticsPage }) {
  return <form action={action} className={className} onSubmit={event => {
    const data = new FormData(event.currentTarget);
    const keys = [...new Set([...data.entries()].filter(([key, value]) => FILTER_KEYS.has(key) && typeof value === 'string' && value.trim() !== '').map(([key]) => key))];
    trackProductEvent({ event: 'feed_filter_change', page, source: page === 'catalog' ? 'catalog' : 'feed', filterKeys: keys as ClientProductEvent['filterKeys'] });
  }}>{children}</form>;
}
