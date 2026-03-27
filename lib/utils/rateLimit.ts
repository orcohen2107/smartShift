import { NextResponse } from 'next/server';

// ── Types ──

type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

// ── Redis-backed rate limiter (production) ──

async function rateLimitRedis(
  key: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const { Ratelimit } = await import('@upstash/ratelimit');
  const { Redis } = await import('@upstash/redis');

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const windowSeconds = Math.floor(config.windowMs / 1000);
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds}s`),
    prefix: 'rl',
  });

  const { success, reset } = await limiter.limit(key);

  if (!success) {
    const retryAfterSec = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.max(retryAfterSec, 1)) },
      }
    );
  }

  return null;
}

// ── In-memory rate limiter (dev fallback) ──

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

function rateLimitMemory(
  key: string,
  config: RateLimitConfig
): NextResponse | null {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  entry.count++;

  if (entry.count > config.maxRequests) {
    const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSec) },
      }
    );
  }

  return null;
}

// ── Public API ──

export async function rateLimit(
  req: Request,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const url = new URL(req.url);
  const key = `${ip}:${url.pathname}`;

  const useRedis =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (useRedis) {
    try {
      return await rateLimitRedis(key, config);
    } catch {
      // Fall back to in-memory if Redis is unreachable
    }
  }

  return rateLimitMemory(key, config);
}
