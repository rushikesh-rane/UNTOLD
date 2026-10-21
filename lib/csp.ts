// Builds the Content-Security-Policy header. A new random nonce is generated for every request in
// middleware.ts; Next.js reads it from the request header and stamps it on its own inline scripts, so only
// scripts the server rendered can run. Anything injected into the page (for example through a story) cannot.
//
// To trial a change without breaking the site, set CSP_REPORT_ONLY=true: the browser then only reports
// violations in the console instead of blocking them.

function supabaseOrigin(): { http: string; ws: string } {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    if (raw) {
      const url = new URL(raw);
      return { http: url.origin, ws: `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}` };
    }
  } catch {
    /* fall through to the wildcard */
  }
  return { http: 'https://*.supabase.co', ws: 'wss://*.supabase.co' };
}

export function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV !== 'production';
  const supabase = supabaseOrigin();
  const turnstile = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-eval' is only needed by React's development tooling, never in production.
    'script-src': ["'self'", `'nonce-${nonce}'`, ...(dev ? ["'unsafe-eval'"] : []), ...(turnstile ? ['https://challenges.cloudflare.com'] : [])],
    // Styles stay 'unsafe-inline' because React and the editor set inline style attributes; injected styles
    // cannot run code, and scripts (the dangerous part) are locked down above.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Only our own files, inline data/blob images, and our Supabase storage. This also stops people from putting
    // an external "tracking pixel" image in a profile, cover or story.
    'img-src': ["'self'", 'data:', 'blob:', supabase.http],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", supabase.http, supabase.ws, ...(dev ? ['ws:', 'http://localhost:*'] : []), ...(turnstile ? ['https://challenges.cloudflare.com'] : [])],
    'frame-src': turnstile ? ['https://challenges.cloudflare.com'] : ["'none'"],
    'media-src': ["'self'", 'blob:', 'data:'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`);
  if (!dev) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export const CSP_HEADER = process.env.CSP_REPORT_ONLY === 'true' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
