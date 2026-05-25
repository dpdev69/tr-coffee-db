type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  namespace: string;
  now?: number;
  windowMs: number;
};

const globalRateLimitState = globalThis as typeof globalThis & {
  __trCoffeeDbRateLimits?: Map<string, RateLimitBucket>;
};

export function checkRateLimit({
  key,
  limit,
  namespace,
  now = Date.now(),
  windowMs,
}: RateLimitOptions) {
  const buckets = getBuckets();
  const bucketKey = `${namespace}:${key}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

function getBuckets() {
  if (!globalRateLimitState.__trCoffeeDbRateLimits) {
    globalRateLimitState.__trCoffeeDbRateLimits = new Map();
  }

  return globalRateLimitState.__trCoffeeDbRateLimits;
}
