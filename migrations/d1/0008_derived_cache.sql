-- Results that are the same for every visitor until the next refresh (catalog counts, roaster and origin lists,
-- landing facts, similarity and quiz candidates), computed once and shared by every Worker location (shared/v2/read-cache.ts).
-- Disposable: rows only ever repeat what the catalog views already say; the nightly job invalidates them after
-- corrections. Creating an empty table reads no catalog rows.
CREATE TABLE IF NOT EXISTS derived_cache (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
