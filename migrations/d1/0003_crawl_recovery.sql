CREATE INDEX crawl_runs_pending ON crawl_runs(started_at) WHERE status='running';
