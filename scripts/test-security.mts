// Run with: npm run test:security
import assert from 'node:assert/strict';
import { cleanText, escapeLike, isUuid, safeNextPath } from '../lib/security.ts';
import { rateLimit, resetRateLimitMemory } from '../lib/rate-limit.ts';
import { buildCsp } from '../lib/csp.ts';

let checks = 0;
const ok = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => { checks += 1; }, (error) => { console.error(`FAILED: ${name}`); throw error; });

// ---- open-redirect protection ------------------------------------------------------------
const attacks = [
  '//evil.com', '/\\evil.com', '\\\\evil.com', '/\\/evil.com', '///evil.com', '/\t/evil.com', '/\n/evil.com', '/\r/evil.com',
  '/.//evil.com', '/./\\evil.com', 'https://evil.com', 'http://evil.com', 'javascript:alert(1)', 'data:text/html,hi', '//\\evil.com',
  'evil.com', ' //evil.com', '/\u0000/evil.com', 'x'.repeat(600),
];
for (const attack of attacks) await ok(`blocks ${JSON.stringify(attack)}`, () => assert.equal(safeNextPath(attack), '/'));
for (const good of ['/', '/account', '/write', '/u/minnie', '/?story=abc', '/community#top', '/u/minnie/followers']) {
  await ok(`allows ${good}`, () => assert.equal(safeNextPath(good), good));
}
await ok('fallback respected', () => assert.equal(safeNextPath('//evil.com', '/account'), '/account'));
await ok('null and undefined', () => { assert.equal(safeNextPath(null), '/'); assert.equal(safeNextPath(undefined), '/'); });
await ok('percent-encoded slashes stay a harmless path', () => assert.ok(safeNextPath('/%2F%2Fevil.com').startsWith('/')));
await ok('never returns a protocol-relative result', () => {
  for (const attack of attacks) assert.ok(!safeNextPath(attack).startsWith('//'));
});

// ---- ids, text, LIKE ---------------------------------------------------------------------
await ok('uuid accepts real ids', () => assert.ok(isUuid('3f2b8c1e-5d4a-4b7e-9c3a-1a2b3c4d5e6f')));
for (const bad of ['', 'abc', "1' or '1'='1", '3f2b8c1e-5d4a-4b7e-9c3a-1a2b3c4d5e6', null, undefined, 123, {}, ['3f2b8c1e-5d4a-4b7e-9c3a-1a2b3c4d5e6f']]) {
  await ok(`uuid rejects ${JSON.stringify(bad)}`, () => assert.equal(isUuid(bad), false));
}
await ok('escapeLike', () => assert.equal(escapeLike('a_b%c\\d'), 'a\\_b\\%c\\\\d'));
await ok('cleanText trims and bounds', () => {
  assert.equal(cleanText('  hello  ', 1, 10), 'hello');
  assert.equal(cleanText('', 1, 10), null);
  assert.equal(cleanText('   ', 1, 10), null);
  assert.equal(cleanText('x'.repeat(11), 1, 10), null);
  assert.equal(cleanText(42, 1, 10), null);
  assert.equal(cleanText('a\u0000b', 1, 10), 'ab');
});

// ---- rate limiter ------------------------------------------------------------------------
await ok('allows up to the limit then blocks', async () => {
  resetRateLimitMemory();
  for (let i = 0; i < 5; i += 1) assert.equal((await rateLimit('t:a', 5, 60)).ok, true);
  const blocked = await rateLimit('t:a', 5, 60);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfter >= 1 && blocked.retryAfter <= 60);
});
await ok('keys are independent', async () => {
  resetRateLimitMemory();
  for (let i = 0; i < 3; i += 1) await rateLimit('t:one', 3, 60);
  assert.equal((await rateLimit('t:one', 3, 60)).ok, false);
  assert.equal((await rateLimit('t:two', 3, 60)).ok, true);
});
await ok('window resets', async () => {
  resetRateLimitMemory();
  assert.equal((await rateLimit('t:w', 1, 1)).ok, true);
  assert.equal((await rateLimit('t:w', 1, 1)).ok, false);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.equal((await rateLimit('t:w', 1, 1)).ok, true);
});
await ok('survives a flood of unique keys', async () => {
  resetRateLimitMemory();
  for (let i = 0; i < 12_000; i += 1) await rateLimit(`flood:${i}`, 5, 60);
  assert.equal((await rateLimit('after-flood', 5, 60)).ok, true);
});

// ---- content security policy -------------------------------------------------------------
await ok('CSP is strict about scripts and framing', () => {
  const csp = buildCsp('NONCE123');
  const scriptSrc = csp.split('; ').find((part) => part.startsWith('script-src')) ?? '';
  assert.ok(scriptSrc.includes("'nonce-NONCE123'"));
  assert.ok(!scriptSrc.includes("'unsafe-inline'"));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("base-uri 'self'"));
  assert.ok(csp.includes("form-action 'self'"));
  assert.ok(!/img-src[^;]*\bhttps:(?!\/)/.test(csp), 'img-src must not allow every https site');
});

console.log(`security checks: all ${checks} passed`);
