// Run with: npm run test:polls
import assert from 'node:assert/strict';
import { cleanPollInput, POLL_LIMITS, votePercent } from '../lib/polls.ts';

let checks = 0;
const ok = (name: string, fn: () => void) => { try { fn(); checks += 1; } catch (error) { console.error(`FAILED: ${name}`); throw error; } };
const fine = (q: unknown, o: unknown) => { const r = cleanPollInput(q, o); assert.ok(!('error' in r), JSON.stringify(r)); return r as { question: string; options: string[] }; };
const bad = (q: unknown, o: unknown) => { const r = cleanPollInput(q, o); assert.ok('error' in r, 'expected an error'); return (r as { error: string }).error; };

ok('accepts a normal prediction', () => assert.deepEqual(fine('What happens next?', ['The knight returns', 'The queen did it']), { question: 'What happens next?', options: ['The knight returns', 'The queen did it'] }));
ok('trims and collapses whitespace', () => assert.deepEqual(fine('  What   happens\n next? ', ['  a   b ', 'c']), { question: 'What happens next?', options: ['a b', 'c'] }));
ok('drops blank options', () => assert.deepEqual(fine('What happens next?', ['One', '', '   ', 'Two']).options, ['One', 'Two']));
ok('accepts exactly 6 options', () => assert.equal(fine('What happens next?', ['1', '2', '3', '4', '5', '6']).options.length, POLL_LIMITS.optionsMax));
ok('rejects 7 options', () => assert.match(bad('What happens next?', ['1', '2', '3', '4', '5', '6', '7']), /at most 6/));
ok('rejects a single option', () => assert.match(bad('What happens next?', ['Only one']), /at least 2/));
ok('rejects only blank options', () => assert.match(bad('What happens next?', ['', ' ']), /at least 2/));
ok('rejects duplicate options, ignoring case', () => assert.match(bad('What happens next?', ['Yes', 'yes']), /different/));
ok('rejects too-short question', () => assert.match(bad('Hi?', ['a', 'b']), /at least 5/));
ok('rejects too-long question', () => assert.match(bad('x'.repeat(161), ['a', 'b']), /at most 160/));
ok('accepts a 160-character question', () => fine('x'.repeat(160), ['a', 'b']));
ok('rejects too-long option', () => assert.match(bad('What happens next?', ['x'.repeat(121), 'b']), /at most 120/));
ok('accepts a 120-character option', () => fine('What happens next?', ['x'.repeat(120), 'b']));
ok('rejects non-string question', () => { bad(42, ['a', 'b']); bad(null, ['a', 'b']); bad(undefined, ['a', 'b']); bad({}, ['a', 'b']); });
ok('rejects non-array options', () => { bad('What happens next?', 'a,b'); bad('What happens next?', null); bad('What happens next?', { 0: 'a' }); });
ok('rejects non-string option entries', () => { bad('What happens next?', ['a', 5]); bad('What happens next?', ['a', null]); bad('What happens next?', ['a', ['b']]); });
ok('strips NUL characters', () => assert.deepEqual(fine('What\u0000 happens next?', ['a\u0000b', 'c']), { question: 'What happens next?', options: ['ab', 'c'] }));
ok('percent maths', () => {
  assert.equal(votePercent(6, 10), 60);
  assert.equal(votePercent(1, 3), 33);
  assert.equal(votePercent(0, 10), 0);
  assert.equal(votePercent(5, 0), 0);
  assert.equal(votePercent(null, 10), 0);
  assert.equal(votePercent(3, null), 0);
});

console.log(`poll checks: all ${checks} passed`);
