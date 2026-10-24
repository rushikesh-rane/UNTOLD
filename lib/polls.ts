// Shared by the prediction API route, the reader card and the studio panel.
// Kept dependency-free so it also runs in tests.

export const POLL_LIMITS = {
  questionMin: 5,
  questionMax: 160,
  optionsMin: 2,
  optionsMax: 6,
  optionMax: 120,
} as const;

export const DEFAULT_POLL_QUESTION = 'What happens next?';

export type PollOption = {
  id: string;
  label: string;
  position: number;
  /** Vote count. null while the viewer isn't allowed to see results yet (they haven't picked, and voting is open). */
  votes: number | null;
};

export type PollView = {
  id: string;
  storyId: string;
  question: string;
  status: 'open' | 'closed';
  /** True once the author has revealed the real answer. */
  resolved: boolean;
  correctOptionId: string | null;
  options: PollOption[];
  totalVotes: number | null;
  /** The signed-in viewer's own pick, if any. */
  myOptionId: string | null;
  isAuthor: boolean;
};

export type MyPrediction = {
  pollId: string;
  storyId: string;
  storyTitle: string;
  question: string;
  myOption: string;
  status: 'pending' | 'correct' | 'wrong' | 'closed';
};

/**
 * Cleans and validates what an author typed for a prediction. Blank options are dropped, extra spaces are trimmed,
 * and the same limits the database enforces are checked first so the author gets a clear message.
 */
export function cleanPollInput(question: unknown, options: unknown): { question: string; options: string[] } | { error: string } {
  if (typeof question !== 'string') return { error: 'Add a question for your readers.' };
  const cleanQuestion = question.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
  if (cleanQuestion.length < POLL_LIMITS.questionMin) return { error: `The question needs at least ${POLL_LIMITS.questionMin} characters.` };
  if (cleanQuestion.length > POLL_LIMITS.questionMax) return { error: `The question can be at most ${POLL_LIMITS.questionMax} characters.` };

  if (!Array.isArray(options)) return { error: 'Add at least two options.' };
  const cleanOptions: string[] = [];
  for (const raw of options) {
    if (typeof raw !== 'string') return { error: 'Each option must be text.' };
    const label = raw.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
    if (!label) continue;
    if (label.length > POLL_LIMITS.optionMax) return { error: `Each option can be at most ${POLL_LIMITS.optionMax} characters.` };
    cleanOptions.push(label);
  }
  if (cleanOptions.length < POLL_LIMITS.optionsMin) return { error: `Add at least ${POLL_LIMITS.optionsMin} options.` };
  if (cleanOptions.length > POLL_LIMITS.optionsMax) return { error: `Use at most ${POLL_LIMITS.optionsMax} options.` };
  if (new Set(cleanOptions.map((label) => label.toLowerCase())).size !== cleanOptions.length) return { error: 'Each option must be different.' };
  return { question: cleanQuestion, options: cleanOptions };
}

/** Percentage of all votes, rounded; 0 when there are no votes. */
export function votePercent(votes: number | null, total: number | null): number {
  if (!votes || !total) return 0;
  return Math.round((votes / total) * 100);
}
