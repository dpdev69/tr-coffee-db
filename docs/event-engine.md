# Event engine rules

Implementation: shared/v2/events.ts and ingestion.ts. Version v2.1, initial threshold10%, minimum2 baseline observations. Integer minor-unit money prevents floating-point comparisons; TRY lira=current_price_minor/100 only when currency is TRY.

- NEW: first canonical coffee identity in a live crawl, unique by coffee ID. Source ID wins; URL/slug aliases preserve identity. Imports and baseline crawls generate none. A source/alias conflict requires reconciliation instead of a duplicate NEW.
- PRICE_DROP: latest earlier successful source observation for exactly the same offer, same known weight, same known currency, positive lower current price. Unknown weight deliberately suppresses price claims even where SKU matches. Never compare one package with another. Before/after observation IDs retained.
- RESTOCKED: immediately preceding confirmed source stock false → current true for same offer. Unknown or import evidence cannot establish restock. OUT_OF_STOCK is reverse true→false.
- DEAL: PRICE_DROP plus in-stock true, last2 earlier source observations both at previous price and same SKU/weight/currency, decline at least10%. Before metadata names baseline observation IDs; after kind VERIFIED_DEAL. This is transparent deterministic evidence, not a guarantee that no earlier promotion existed.
- Compare-at: stored as a roaster claim; never independently creates DEAL. Consumers may display explicitly labeled roaster promotion only. Missing or questionable compare-at remains reportable.
- Import/baseline: observations retained but no feed events; synthetic legacy offer history is never transferred into a known source SKU. First new baseline retires tagged legacy offers when replacement source offers are observed, preserving all history.
- Failed/partial: only run/health diagnostics mutate. Nonempty partial does not mean successful coverage. Absence never means unavailable; freshness reported separately.
- Replay: stable run ID and input fingerprint, immutable observations, event idempotency keys and atomic batch. Optimistic roaster revision prevents stale read/write plans. Queue-level successful-job uniqueness is a separate guard.
- Current deals: feed query verifies event price still matches current offer state. A later price rise removes the old deal from the active deals feed.

Tests use real SQLite execution plus pure deterministic cases. Remote D1/run/browser acceptance is documented separately. No history can be reconstructed from legacy overwritten prices.
