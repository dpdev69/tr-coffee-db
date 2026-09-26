-- A queue job may have several failed attempts, but at most one successful evidence-producing crawl.
ALTER TABLE crawl_runs ADD COLUMN job_key TEXT;
CREATE UNIQUE INDEX crawl_runs_successful_job ON crawl_runs(job_key) WHERE job_key IS NOT NULL AND status='success';
CREATE INDEX crawl_runs_job ON crawl_runs(job_key,status);
