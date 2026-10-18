export type RawChapter = {
  title: string | null;
  body: string | null;
  is_revealed: boolean;
  reveal_at: string | null;
  position: number;
};

export type ReaderPart = {
  position: number;
  /** Visible heading, or '' when the title is just the auto-generated "Part N". */
  heading: string;
  paragraphs: string[];
};

export type ReaderImage = { src: string; alt: string; caption: string };

const IMAGE_MD = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;

/** A chapter is readable once it is marked revealed and its release time (if any) has passed. */
export function isChapterReleased(chapter: Pick<RawChapter, 'is_revealed' | 'reveal_at'>, now: Date = new Date()): boolean {
  if (!chapter.is_revealed) return false;
  if (!chapter.reveal_at) return true;
  const at = Date.parse(chapter.reveal_at);
  // An unparseable date should not hide a chapter the author marked as revealed.
  return Number.isNaN(at) || at <= now.getTime();
}

/**
 * Every released chapter becomes one readable part, in order.
 * Nothing here decides what is "hidden": chapters that are not released never reach the reader
 * (the database policy filters them out), so every part returned is safe and meant to be read.
 */
export function buildReaderParts(chapters: RawChapter[], now: Date = new Date()): { parts: ReaderPart[]; images: ReaderImage[] } {
  const released = chapters
    .filter((chapter) => isChapterReleased(chapter, now))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const images: ReaderImage[] = [];
  const parts: ReaderPart[] = [];

  released.forEach((chapter, index) => {
    const raw = chapter.body ?? '';
    for (const match of raw.matchAll(IMAGE_MD)) {
      images.push({ src: match[2], alt: match[1] || 'Story illustration', caption: match[1] || 'A moment from the story' });
    }
    const paragraphs = raw
      .replace(IMAGE_MD, '')
      .split(/\n{2,}/)
      .map((text) => text.trim())
      .filter(Boolean);
    const title = (chapter.title ?? '').trim();
    const isAutoTitle = /^part\s+\d+$/i.test(title);
    if (!paragraphs.length && !title) return;
    parts.push({ position: chapter.position > 0 ? chapter.position : index + 1, heading: isAutoTitle ? '' : title, paragraphs });
  });

  return { parts, images };
}

export function partsToPlainText(parts: ReaderPart[]): string {
  return parts.map((part) => [part.heading, ...part.paragraphs].filter(Boolean).join('. ')).join(' ');
}

// ---------------------------------------------------------------------------------------------
// Parts that are scheduled but not released yet. Readers only ever learn the part number and the
// release time (see the upcoming_chapters() database function); never the title or the text.
// ---------------------------------------------------------------------------------------------

export type UpcomingPart = { position: number; revealAt: string };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function buildUpcomingParts(
  rows: { position: number; reveal_at: string | null }[] | null | undefined,
  now: Date = new Date(),
): UpcomingPart[] {
  return (rows ?? [])
    .filter((row): row is { position: number; reveal_at: string } => Boolean(row.reveal_at) && Date.parse(row.reveal_at as string) > now.getTime())
    .map((row) => ({ position: row.position, revealAt: row.reveal_at }))
    .sort((a, b) => a.position - b.position);
}

/** "2 days", "5 hours", "12 minutes". Rounds up so a part set for 7 days reads "7 days" the moment it goes live. */
export function formatTimeLeft(ms: number): string {
  if (ms < MINUTE) return 'less than a minute';
  if (ms < HOUR) { const m = Math.ceil(ms / MINUTE); return `${m} ${m === 1 ? 'minute' : 'minutes'}`; }
  if (ms < DAY) {
    const h = Math.ceil(ms / HOUR);
    if (h >= 24) return '1 day';
    return `${h} ${h === 1 ? 'hour' : 'hours'}`;
  }
  const d = Math.ceil(ms / DAY);
  return `${d} ${d === 1 ? 'day' : 'days'}`;
}

/** Headline for one scheduled part, e.g. "Part 2 reveals in 2 days". `ready` means the time has passed. */
export function countdownLabel(part: UpcomingPart, now: Date = new Date()): { text: string; ready: boolean } {
  const ms = Date.parse(part.revealAt) - now.getTime();
  if (!Number.isFinite(ms)) return { text: `Part ${part.position} is coming`, ready: false };
  if (ms <= 0) return { text: `Part ${part.position} is out now`, ready: true };
  return { text: `Part ${part.position} reveals in ${formatTimeLeft(ms)}`, ready: false };
}

export function formatRevealDate(revealAt: string, locale?: string): string {
  const date = new Date(revealAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
