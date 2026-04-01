import { NextRequest } from 'next/server';

const windows = new Map<string, { count: number; reset: number }>();
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export type RateLimitResult = {
  success: boolean;
  retryAfter?: number;
};

function localRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = windows.get(key) ?? { count: 0, reset: now + windowMs };
  if (entry.reset < now) {
    entry.count = 0;
    entry.reset = now + windowMs;
  }
  entry.count += 1;
  windows.set(key, entry);
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.reset - now) / 1000);
    return { success: false, retryAfter };
  }
  return { success: true };
}

async function upstashRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!redisUrl || !redisToken) {
    return localRateLimit(key, limit, windowMs);
  }

  const ttlSeconds = Math.ceil(windowMs / 1000);
  const fullKey = `ratelimit:${key}`;
  const endpoint = `${redisUrl}/pipeline`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', fullKey],
      ['EXPIRE', fullKey, ttlSeconds, 'NX'],
      ['TTL', fullKey],
    ]),
  });

  if (!response.ok) {
    return localRateLimit(key, limit, windowMs);
  }

  const data = (await response.json()) as Array<{ result: number }>;
  const count = Number(data?.[0]?.result ?? 0);
  const ttl = Math.max(Number(data?.[2]?.result ?? ttlSeconds), 1);

  if (count > limit) {
    return { success: false, retryAfter: ttl };
  }
  return { success: true };
}

export async function rateLimit(
  key: string,
  limit = 60,
  windowMs = 60_000
): Promise<RateLimitResult> {
  try {
    return await upstashRateLimit(key, limit, windowMs);
  } catch {
    return localRateLimit(key, limit, windowMs);
  }
}

export function getRequestIp(req: Request | NextRequest): string {
  const fromHeader =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim();
  return fromHeader || 'unknown';
}
