/**
 * Guest access: what someone who has NOT signed in may see and do.
 * Everything that decides it lives here (and in the middleware) so the rules are easy to change.
 *
 * Guests CAN: browse and search the feed, open any published story and read its first part(s), read theories,
 * replies and prediction results, see public creator profiles, and use "How it works" / "What's new".
 * Guests CANNOT: read past the free parts, save stories, follow creators, post or like theories, reply,
 * make predictions, write stories, or open Community / Account.
 *
 * Guests also get a timed sign-in popup (components/GuestSignInNudge.tsx) once per visit.
 */

/** How many released parts of each story a guest can read before being asked to sign in. */
export const GUEST_FREE_PARTS = 1;

/** How many seconds a guest spends actively using the site, in one visit, before the sign-in popup appears. */
export const GUEST_NUDGE_AFTER_SECONDS = 45;

/** Pages anyone can open. Everything else needs an account. */
const PUBLIC_PAGES = new Set(['/', '/login', '/auth/callback', '/demo-access', '/how-it-works', '/whats-new']);

/** A creator's public profile (/u/name) is open; their follower lists (/u/name/followers) are not. */
const PUBLIC_PROFILE = /^\/u\/[^/]+\/?$/;

/** Read-only API endpoints guests may call (GET only). Every write endpoint still demands a signed-in user. */
const PUBLIC_API_READS = ['/api/stories', '/api/replies', '/api/theories', '/api/theory-votes', '/api/polls'];

export function isPublicPage(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || PUBLIC_PROFILE.test(pathname);
}

export function isPublicApiRead(pathname: string, method: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false;
  return PUBLIC_API_READS.some((prefix) => pathname === prefix);
}

/** The sign-in flow itself: asking someone to sign in while they are signing in would be silly. */
const SIGN_IN_FLOW = ['/login', '/auth', '/demo-access'];

/** Where the timed sign-in popup may appear: any page a guest can open, except the sign-in flow. */
export function canShowGuestNudge(pathname: string): boolean {
  const inSignInFlow = SIGN_IN_FLOW.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return !inSignInFlow && isPublicPage(pathname);
}
