// Run with: npm run test:guest
import assert from 'node:assert/strict';
import { canShowGuestNudge, GUEST_FREE_PARTS, GUEST_NUDGE_AFTER_SECONDS, isPublicApiRead, isPublicPage } from '../lib/guest.ts';

let checks = 0;
const ok = (name: string, fn: () => void) => { try { fn(); checks += 1; } catch (error) { console.error(`FAILED: ${name}`); throw error; } };

// Pages a guest may open
for (const path of ['/', '/login', '/auth/callback', '/how-it-works', '/whats-new', '/u/minnie', '/u/minnie/']) {
  ok(`guest can open ${path}`, () => assert.equal(isPublicPage(path), true));
}
// Pages that need an account
for (const path of ['/account', '/write', '/community', '/u/minnie/followers', '/u/minnie/following', '/u', '/admin', '/accounts', '/u/a/b/c']) {
  ok(`guest blocked from ${path}`, () => assert.equal(isPublicPage(path), false));
}

// Read-only API calls guests may make
for (const path of ['/api/stories', '/api/replies', '/api/theories', '/api/theory-votes', '/api/polls']) {
  ok(`guest can GET ${path}`, () => assert.equal(isPublicApiRead(path, 'GET'), true));
  for (const method of ['POST', 'DELETE', 'PUT', 'PATCH']) {
    ok(`guest cannot ${method} ${path}`, () => assert.equal(isPublicApiRead(path, method), false));
  }
}
// Endpoints that are never open to guests, and look-alike paths
for (const path of ['/api/bookmarks', '/api/follows', '/api/stories/extra', '/api/storiesx', '/api']) {
  ok(`guest blocked from API ${path}`, () => assert.equal(isPublicApiRead(path, 'GET'), false));
}

ok('guests get at least one free part, but not everything', () => {
  assert.ok(Number.isInteger(GUEST_FREE_PARTS) && GUEST_FREE_PARTS >= 1 && GUEST_FREE_PARTS <= 3);
});

// The timed sign-in popup
for (const path of ['/', '/how-it-works', '/whats-new', '/u/minnie']) {
  ok(`nudge can show on ${path}`, () => assert.equal(canShowGuestNudge(path), true));
}
for (const path of ['/login', '/auth/callback', '/demo-access', '/account', '/write']) {
  ok(`nudge never shows on ${path}`, () => assert.equal(canShowGuestNudge(path), false));
}
ok('nudge delay is a sensible positive number of seconds', () => {
  assert.ok(Number.isInteger(GUEST_NUDGE_AFTER_SECONDS) && GUEST_NUDGE_AFTER_SECONDS > 0);
});

console.log(`guest checks: all ${checks} passed`);
