import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildGitHubStepSummary,
  evaluateScrapeRun,
  findUnknownTargetSlugs,
  parseMaxAttempts,
  parseMinimumSuccessRate,
  runWithRetries,
  type OrchestratorResult,
} from '../scrapers/src/run-policy.ts';

describe('scheduled scrape run policy', () => {
  it('keeps a broad refresh green when at least 90% of attempted roasters succeed', () => {
    const results = [
      ...Array.from({ length: 32 }, (_, index) => success(`ok-${index}`)),
      failed('story'),
      failed('coffeerem'),
      failed('cho-coffee'),
      skipped('sezy'),
    ];

    const evaluation = evaluateScrapeRun({
      allowedFailureSlugs: new Set(['story', 'cho-coffee']),
      minimumSuccessRate: 0.9,
      results,
      targeted: false,
    });

    assert.equal(evaluation.attempted, 35);
    assert.equal(evaluation.succeeded, 32);
    assert.equal(evaluation.failed.length, 3);
    assert.equal(evaluation.shouldFail, false);
    assert.equal(evaluation.unexpectedFailures[0]?.slug, 'coffeerem');
  });

  it('fails a broad refresh when catalog-wide success drops below 90%', () => {
    const results = [
      ...Array.from({ length: 31 }, (_, index) => success(`ok-${index}`)),
      failed('one'),
      failed('two'),
      failed('three'),
      failed('four'),
    ];

    const evaluation = evaluateScrapeRun({
      allowedFailureSlugs: new Set(['one', 'two', 'three', 'four']),
      minimumSuccessRate: 0.9,
      results,
      targeted: false,
    });

    assert.equal(evaluation.requiredSuccesses, 32);
    assert.equal(evaluation.succeeded, 31);
    assert.equal(evaluation.shouldFail, true);
  });

  it('keeps targeted manual probes strict even when a rate is configured', () => {
    const evaluation = evaluateScrapeRun({
      allowedFailureSlugs: new Set(['target']),
      minimumSuccessRate: 0.5,
      results: [failed('target')],
      targeted: true,
    });

    assert.equal(evaluation.policy, 'targeted');
    assert.equal(evaluation.shouldFail, true);
  });

  it('preserves allowlist behavior when no broad-run rate is configured', () => {
    const allowed = evaluateScrapeRun({
      allowedFailureSlugs: new Set(['known']),
      minimumSuccessRate: null,
      results: [success('ok'), failed('known')],
      targeted: false,
    });
    const unexpected = evaluateScrapeRun({
      allowedFailureSlugs: new Set(['known']),
      minimumSuccessRate: null,
      results: [success('ok'), failed('new')],
      targeted: false,
    });

    assert.equal(allowed.shouldFail, false);
    assert.equal(unexpected.shouldFail, true);
  });

  it('retries a failed roaster and returns the successful retry', async () => {
    let attempts = 0;
    const retried: number[] = [];

    const result = await runWithRetries({
      maxAttempts: 2,
      onRetry: ({ attempt }) => retried.push(attempt),
      run: async () => {
        attempts += 1;
        return attempts === 1 ? failed('flaky') : success('flaky');
      },
      sleep: async () => undefined,
    });

    assert.equal(result.status, 'success');
    assert.equal(attempts, 2);
    assert.deepEqual(retried, [1]);
  });

  it('returns immediately after a successful first attempt', async () => {
    let attempts = 0;

    const result = await runWithRetries({
      maxAttempts: 2,
      run: async () => {
        attempts += 1;
        return success('healthy');
      },
      sleep: async () => undefined,
    });

    assert.equal(result.status, 'success');
    assert.equal(attempts, 1);
  });

  it('returns the terminal failed result after exhausting attempts', async () => {
    let attempts = 0;

    const result = await runWithRetries({
      maxAttempts: 2,
      run: async () => {
        attempts += 1;
        return failed('still-flaky');
      },
      sleep: async () => undefined,
    });

    assert.equal(result.status, 'failed');
    assert.equal(attempts, 2);
  });

  it('retries thrown transient errors and rethrows the terminal error', async () => {
    let recoverableAttempts = 0;
    const recovered = await runWithRetries({
      maxAttempts: 2,
      run: async () => {
        recoverableAttempts += 1;
        if (recoverableAttempts === 1) throw new Error('temporary exception');
        return success('recovered');
      },
      sleep: async () => undefined,
    });

    assert.equal(recovered.status, 'success');
    assert.equal(recoverableAttempts, 2);

    await assert.rejects(
      runWithRetries({
        maxAttempts: 2,
        run: async () => {
          throw new Error('terminal exception');
        },
        sleep: async () => undefined,
      }),
      /terminal exception/
    );
  });

  it('fails empty runs and handles exact success-rate boundaries', () => {
    const empty = evaluateScrapeRun({
      allowedFailureSlugs: new Set(),
      minimumSuccessRate: 0.9,
      results: [skipped('configured-skip')],
      targeted: false,
    });
    const exact = evaluateScrapeRun({
      allowedFailureSlugs: new Set(),
      minimumSuccessRate: 0.8,
      results: [success('one'), success('two'), success('three'), success('four'), failed('five')],
      targeted: false,
    });
    const below = evaluateScrapeRun({
      allowedFailureSlugs: new Set(),
      minimumSuccessRate: 0.81,
      results: [success('one'), success('two'), success('three'), success('four'), failed('five')],
      targeted: false,
    });

    assert.equal(empty.shouldFail, true);
    assert.equal(exact.shouldFail, false);
    assert.equal(below.shouldFail, true);
  });

  it('reports every unknown targeted slug once', () => {
    assert.deepEqual(
      findUnknownTargetSlugs(['petra', 'typo', 'typo'], ['petra', 'montag']),
      ['typo']
    );
  });

  it('validates policy environment values and renders a readable Actions summary', () => {
    assert.equal(parseMinimumSuccessRate('0.9'), 0.9);
    assert.equal(parseMinimumSuccessRate(''), null);
    assert.equal(parseMaxAttempts('2'), 2);
    assert.throws(() => parseMinimumSuccessRate('90'));
    assert.throws(() => parseMaxAttempts('0'));

    const results = [success('healthy'), failed('flaky')];
    const evaluation = evaluateScrapeRun({
      allowedFailureSlugs: new Set(),
      minimumSuccessRate: 0.5,
      results,
      targeted: false,
    });
    const summary = buildGitHubStepSummary({
      elapsedSeconds: '12.3',
      evaluation,
      results,
    });

    assert.match(summary, /Scrape health/);
    assert.match(summary, /Degraded/);
    assert.match(summary, /healthy/);
    assert.match(summary, /flaky/);
  });
});

function success(slug: string): OrchestratorResult {
  return {
    slug,
    status: 'success',
    roasterId: `id-${slug}`,
    productsFound: 10,
    productsUpserted: 10,
    specialtyQualified: 8,
    specialtyRejected: 2,
    specialtyUnclassified: 0,
    durationMs: 100,
  };
}

function failed(slug: string): OrchestratorResult {
  return { slug, status: 'failed', error: 'temporary upstream failure' };
}

function skipped(slug: string): OrchestratorResult {
  return { slug, status: 'skipped', reason: 'configured skip' };
}
