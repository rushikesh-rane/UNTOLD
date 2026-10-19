import assert from 'node:assert/strict';
import { buildReaderParts, buildUpcomingParts, countdownLabel, formatTimeLeft, isChapterReleased, isRecentlyPublished, partsToPlainText, type RawChapter } from '../lib/reader.ts';

const NOW = new Date('2026-10-18T12:00:00Z');
const day = 86400e3;
const ch = (o: Partial<RawChapter>): RawChapter => ({ title: 'Part 1', body: 'Text.', is_revealed: true, reveal_at: null, position: 1, ...o });

// 1. The reported scenario: two parts, both revealed -> both readable, in order.
{
  const { parts } = buildReaderParts([
    ch({ position: 2, title: 'The photo', body: 'Then I checked the one thing he forgot.', reveal_at: new Date(NOW.getTime() - day).toISOString() }),
    ch({ position: 1, title: 'Part 1', body: 'He said he was asleep.' }),
  ], NOW);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts.map((p) => p.position), [1, 2]);
  assert.deepEqual(parts[0].paragraphs, ['He said he was asleep.']);
  assert.equal(parts[0].heading, '');            // auto "Part 1" title is not repeated as a heading
  assert.equal(parts[1].heading, 'The photo');
  assert.deepEqual(parts[1].paragraphs, ['Then I checked the one thing he forgot.']);
}
// 2. Three revealed parts all come through.
assert.equal(buildReaderParts([1, 2, 3].map((n) => ch({ position: n, title: `Part ${n}`, body: `Body ${n}` })), NOW).parts.length, 3);
// 3. Future / unrevealed chapters never become parts.
{
  const { parts } = buildReaderParts([
    ch({ position: 1 }),
    ch({ position: 2, reveal_at: new Date(NOW.getTime() + 2 * day).toISOString() }),
    ch({ position: 3, is_revealed: false }),
  ], NOW);
  assert.equal(parts.length, 1);
}
// 4. Single-part story is one part, no hidden-card trigger.
assert.equal(buildReaderParts([ch({})], NOW).parts.length, 1);
// 5. Blank-line paragraphs are split; images are pulled out of the text and collected from every part.
{
  const { parts, images } = buildReaderParts([
    ch({ position: 1, body: 'One.\n\nTwo.\n\n![Receipt](https://x.test/a.png)' }),
    ch({ position: 2, title: 'Next', body: 'Three. ![Door](https://x.test/b.png)' }),
  ], NOW);
  assert.deepEqual(parts[0].paragraphs, ['One.', 'Two.']);
  assert.deepEqual(parts[1].paragraphs, ['Three.']);
  assert.deepEqual(images.map((i) => i.alt), ['Receipt', 'Door']);
}
// 6. Bad date on a revealed chapter must not hide it; null body is tolerated.
assert.equal(isChapterReleased({ is_revealed: true, reveal_at: 'not-a-date' }, NOW), true);
assert.equal(buildReaderParts([ch({ body: null, title: 'Prologue' })], NOW).parts.length, 1);
// 7. Narration text covers every part.
{
  const { parts } = buildReaderParts([ch({ position: 1, body: 'Alpha.' }), ch({ position: 2, title: 'B', body: 'Beta.' })], NOW);
  const text = partsToPlainText(parts);
  assert.ok(text.includes('Alpha.') && text.includes('Beta.'));
}


// ---- Scheduled parts (the "Part 2 reveals in 2 days" feature) ----
const H = 3600e3;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

// 8. The reported scenario: Part 1 is out, Part 2 is scheduled for 2 days from now.
{
  const chapters = [ch({ position: 1, body: 'Part one text.' }), ch({ position: 2, title: 'SECRET TITLE', body: 'SECRET BODY', reveal_at: at(2 * 24 * H) })];
  const { parts } = buildReaderParts(chapters, NOW);
  assert.equal(parts.length, 1);                                   // Part 2 is not readable
  const upcoming = buildUpcomingParts([{ position: 2, reveal_at: at(2 * 24 * H) }], NOW);
  assert.equal(upcoming.length, 1);
  assert.equal(countdownLabel(upcoming[0], NOW).text, 'Part 2 reveals in 2 days');
  assert.equal(countdownLabel(upcoming[0], NOW).ready, false);
  // What the reader receives has no title or body anywhere in it.
  assert.ok(!JSON.stringify(upcoming).includes('SECRET'));
}
// 9. Wording: rounds up, switches units, handles singular/plural.
assert.equal(formatTimeLeft(7 * 24 * H - 1000), '7 days');         // a part set for 7 days still says 7 right after publishing
assert.equal(formatTimeLeft(24 * H), '1 day');
assert.equal(formatTimeLeft(23.5 * H), '1 day');
assert.equal(formatTimeLeft(5 * H - 1), '5 hours');
assert.equal(formatTimeLeft(1 * H), '1 hour');
assert.equal(formatTimeLeft(12 * 60e3), '12 minutes');
assert.equal(formatTimeLeft(1), 'less than a minute');
// 10. When the time passes the label flips to "out now" and is marked ready.
{
  const part = { position: 2, revealAt: at(60e3) };
  assert.equal(countdownLabel(part, new Date(NOW.getTime() + 120e3)).ready, true);
  assert.equal(countdownLabel(part, new Date(NOW.getTime() + 120e3)).text, 'Part 2 is out now');
}
// 11. Past/empty/garbage rows are dropped; several parts sort by number; null input is fine.
{
  const up = buildUpcomingParts([
    { position: 4, reveal_at: at(4 * 24 * H) },
    { position: 3, reveal_at: at(2 * 24 * H) },
    { position: 2, reveal_at: at(-H) },
    { position: 5, reveal_at: null },
  ], NOW);
  assert.deepEqual(up.map((u) => u.position), [3, 4]);
  assert.deepEqual(buildUpcomingParts(null, NOW), []);
  assert.deepEqual(buildUpcomingParts(undefined, NOW), []);
}
// 12. Real part numbers are kept: Part 3 out early, Part 2 still scheduled.
{
  const { parts } = buildReaderParts([ch({ position: 1 }), ch({ position: 3, title: 'Late', body: 'Three.' })], NOW);
  assert.deepEqual(parts.map((p) => p.position), [1, 3]);
}
// 13. "New" tab: published in the last 14 days only.
assert.equal(isRecentlyPublished(at(-2 * 24 * H), NOW), true);
assert.equal(isRecentlyPublished(at(-13 * 24 * H), NOW), true);
assert.equal(isRecentlyPublished(at(-15 * 24 * H), NOW), false);
assert.equal(isRecentlyPublished(at(5 * H), NOW), false);        // dates in the future are not "new"
assert.equal(isRecentlyPublished(null, NOW), false);
assert.equal(isRecentlyPublished('garbage', NOW), false);
console.log('reader helper: all 13 checks passed');
