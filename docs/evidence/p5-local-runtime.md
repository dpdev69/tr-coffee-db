# Local Wrangler baseline evidence

Checked 2026-09-14T21:16:11.102Z. Applied the three corrected Petra, Parsa and Daphne saved captures to the existing Wrangler D1 through the real shared ingestion engine in baseline mode. No network calls or remote writes.

SQLite VACUUM INTO created a consistent backup including committed WAL data at `/Users/me/Documents/codex/coffeedb/coffee/.local/v2/wrangler-before-baselines-2026-09-14T21-16-10-985Z.sqlite` before mutation. The original database and its Cloudflare internal tables were preserved in place.

Canonical counts: 480/38/682 before; **480 coffees, 38 roasters, 682 available offers** after. Source offers: Petra 198, Parsa 22, Daphne 15. Each run's exact replay added no observation. Total observations 1265, including all 1,030 unchanged import observations. All 13,452 source archives remain unchanged. Zero discovery events and foreign-key violations.

This prepares the actual local Worker database for browser QA; it does not establish remote Queue delivery or successful browser flows. Full paths, capture hashes and per-run results are in `.local/v2/local-runtime-baseline-report.json`.

Reproduce with Node 22: `node --import tsx scripts/v2-apply-local-baselines.ts --local-db <existing .wrangler SQLite path>`. The tool refuses files outside the current project's .wrangler directory, missing files, uncorrected parser captures, and unexpected catalog state.


Initial application backup: `.local/v2/wrangler-before-baselines-2026-09-14T21-15-52-509Z.sqlite`. Independent read-only inspection confirmed 480 coffees / 38 roasters / 480 available offers and 1,030 observations in that backup. The first execution completed all writes, then encountered a JavaScript strict-equality prototype mismatch in its final count assertion; actual numerical counts were correct. That assertion now compares plain objects. The full subsequent invocation verified all three runs as exact replays, preserving 1,265 observations and 682 available offers. No rollback or database replacement was performed. ESLint and standalone TypeScript checks pass.
