// Small, dependency-free helpers used by the middleware, API routes and pages.
// Kept free of Node/Next imports so they also run in the Edge runtime (middleware) and in tests.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True only for a well-formed UUID string. Use it before putting any id from a request into a query. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Turns a user-supplied "where to go next" value (the ?next= parameter) into a path that is guaranteed to
 * stay on this site, or returns `fallback`.
 *
 * Why this is stricter than `startsWith('/') && !startsWith('//')`:
 *  - Browsers treat a backslash like a slash, so "/\evil.com" is really "//evil.com" (another site).
 *  - Control characters (tab, newline) are silently removed by URL parsers, turning "/\t/evil.com" into "//evil.com".
 *  - Dot segments can collapse a path into "//evil.com" ("/.//evil.com").
 * So we reject those characters outright, then re-parse and re-check the normalised result.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  try {
    const base = 'https://untold.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    const normalised = `${url.pathname}${url.search}${url.hash}`;
    if (!normalised.startsWith('/') || normalised.startsWith('//')) return fallback;
    return normalised;
  } catch {
    return fallback;
  }
}

/** Escapes % _ and \ so user text can be used as a literal inside a SQL LIKE / ILIKE pattern. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Validates user-written text: must be a string, loses NUL characters (Postgres rejects them), is trimmed, and
 * must be between `min` and `max` characters. Returns the cleaned text, or null if it is not acceptable.
 */
export function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\u0000/g, '').trim();
  return text.length >= min && text.length <= max ? text : null;
}
