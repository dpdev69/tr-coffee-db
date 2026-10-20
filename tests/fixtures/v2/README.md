# Parser fixtures

Synthetic source-format examples cover identity, prices, weights and availability. `live-public-samples.json` retains selected public factual fields from Petra, Daphne and Parsa captured on 14 September 2026, with provenance. Reduced fixtures are not complete catalogs.

The adapter tests additionally exercise paginated IKAS and source-specific option discovery. Full source comparison and ingestion-replay evidence is summarized in `docs/free-catalog-refresh.md`. Do not qualify a source from fixture tests alone. Never commit credentials, cookies or unrelated response data.

`woo-recheck-2026-10-20.json` holds Store API responses from Baristocrat, Coffeemamma, Daphne, Old Java, Poka and Williams recorded on 20 October 2026, reduced to a few products each and to the fields the parser reads.
