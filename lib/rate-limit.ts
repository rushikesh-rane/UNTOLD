// Fixed-window rate limiter.
//
// Two backends:
//  1. Upstash Redis (shared across all servers, accurate). Enabled when UPSTASH_REDIS_REST_URL and
//     UPSTASH_REDIS_REST_TOKEN are set. A free Upstash database is plenty for this app.
//  2. In-memory (default). Works with no setup but only counts requests that hit the SAME server
//     instance, so on serverless hosting (Vercel) it is a speed bump, not a hard limit.
//
// If Redis is configured but unreachable we fall back to memory rather than blocking everyone.
//
// Note: this protects the app's own /api routes. Sign-in and sign-up go straight from the browser to
// Supabase Auth, and the Creator Studio writes straight to the database, so those are protected by
// Supabase's auth rate limits / CAPTCHA and by the database triggers in the security migration.

export type RateLimitResult = { ok: boolean; remaining: number; retryAfter: number };

type Bucket = { count: number; resetAt: number };
const memory = new Map<string, Bucket>();
const MAX_MEMORY_KEYS = 10_000;

function memoryLimit(key: string, limit: number, windowSec: number): RateLimitResult {
  const now = Date.now();
  if (memory.size > MAX_MEMORY_KEYS) {
    for (const [k, b] of memory) if (b.resetAt <= now) memory.delete(k);
    // Still huge (an attack with endless unique keys): drop everything rather than grow without bound.
    if (memory.size > MAX_MEMORY_KEYS) memory.clear();
  }
  let bucket = memory.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowSec * 1000 };
    memory.set(key, bucket);
  }
  bucket.count += 1;
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return { ok: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count), retryAfter };
}

async function redisLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSec), 'NX'],
        ['TTL', key],
      ]),
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return null;
    const out = (await response.json()) as { result?: number }[];
    const count = Number(out?.[0]?.result);
    const ttl = Number(out?.[2]?.result);
    if (!Number.isFinite(count)) return null;
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter: Number.isFinite(ttl) && ttl > 0 ? ttl : windowSec,
    };
  } catch {
    return null;
  }
}

/** Counts one hit against `key` and says whether it is still within `limit` hits per `windowSec` seconds. */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const shared = await redisLimit(`rl:${key}`, limit, windowSec);
  return shared ?? memoryLimit(key, limit, windowSec);
}

/** Best-effort client IP. On Vercel these headers are set by the platform and cannot be spoofed by the caller. */
export function clientIp(request: Request): string {
  const h = request.headers;
  const forwarded = h.get('x-vercel-forwarded-for') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim();
  return first && first.length <= 64 ? first : 'unknown';
}

/** Test helper: forget all in-memory counters. */
export function resetRateLimitMemory() {
  memory.clear();
}
