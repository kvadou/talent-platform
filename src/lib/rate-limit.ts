/**
 * Minimal in-memory rate limiter for public demo endpoints that spend money
 * (OpenAI / Retell). Serverless instances don't share memory, so this is a
 * best-effort cost guard, not a security boundary — it meaningfully raises the
 * bar against a single abuser hammering one instance. Pair with bounded
 * per-request work (max questions, max tokens, max answer length).
 */
type Bucket = { count: number; resetAt: number };

const ipBuckets = new Map<string, Bucket>();
const globalBucket: Bucket = { count: 0, resetAt: 0 };

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

function hit(bucket: Bucket, limit: number, windowMs: number, now: number): boolean {
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/**
 * Returns true when the request is allowed. Enforces both a per-IP limit and a
 * coarse global limit (so total spend is bounded even under distributed abuse).
 */
export function allowRequest(
  req: Request,
  opts: { perIp: number; windowMs: number; global: number; globalWindowMs: number }
): boolean {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded.
  if (ipBuckets.size > 5000) {
    for (const [k, b] of ipBuckets) if (now > b.resetAt) ipBuckets.delete(k);
  }

  if (!hit(globalBucket, opts.global, opts.globalWindowMs, now)) return false;

  const ip = clientIp(req);
  let bucket = ipBuckets.get(ip);
  if (!bucket) {
    bucket = { count: 0, resetAt: 0 };
    ipBuckets.set(ip, bucket);
  }
  return hit(bucket, opts.perIp, opts.windowMs, now);
}

export const TOO_MANY = { error: 'Too many requests. Please slow down and try again shortly.' };
