import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' };

export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function fail(message: string, status: number, headers: Record<string, string> = {}) {
  return json({ error: message }, status, headers);
}

/**
 * Cross-site request forgery defence for requests that change data.
 * Browsers always attach Origin / Sec-Fetch-Site to cross-site requests, so we reject anything that is not
 * clearly from this site. Requests with neither header are not from a browser and cannot ride a victim's
 * login cookie, so they are allowed (they still need a valid session to do anything).
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  if (origin) {
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    try {
      if (!host || new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return true;
}

type GuardOptions = {
  /** Name of the endpoint, so each endpoint has its own counter. */
  scope: string;
  /** Allowed requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
  /** True for POST / DELETE / PUT / PATCH. Adds the cross-site check. */
  mutating?: boolean;
  /** Signed-in user id, if known: limits are then per person rather than per network address. */
  userId?: string | null;
};

/** Runs the origin check and the rate limit. Returns an error response to send back, or null to carry on. */
export async function guard(request: Request, options: GuardOptions): Promise<NextResponse | null> {
  if (options.mutating && !isSameOrigin(request)) {
    return fail('Cross-site requests are not allowed.', 403);
  }
  const subject = options.userId ? `u:${options.userId}` : `ip:${clientIp(request)}`;
  const result = await rateLimit(`${options.scope}:${subject}`, options.limit, options.windowSec);
  if (!result.ok) {
    return fail('You are doing that too quickly. Please wait a moment and try again.', 429, {
      'Retry-After': String(result.retryAfter),
    });
  }
  return null;
}

/** Reads a JSON body with a hard size cap. Returns null when the body is missing, too large or not an object. */
export async function readJson(request: Request, maxBytes = 8_000): Promise<Record<string, unknown> | null> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Turns a database error into a safe response. The raw message (table names, constraint names, SQL hints) is
 * logged on the server only and never sent to the browser.
 */
export function dbFailure(error: { code?: string; message?: string } | null | undefined, fallback = 'Something went wrong. Please try again.') {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (/rate_limit_exceeded/i.test(message)) {
    return fail('You are doing that too quickly. Please wait a moment and try again.', 429, { 'Retry-After': '30' });
  }
  if (code === '42501') return fail('You do not have permission to do that.', 403);
  if (code === '23505') return fail('That already exists.', 409);
  if (code === '23503') return fail('That item no longer exists.', 404);
  if (code === '22P02') return fail('That request was not valid.', 400);
  if (code === '23514') return fail('One of the values you sent is not allowed.', 400);
  console.error('[api] database error', code, message);
  return fail(fallback, 500);
}
