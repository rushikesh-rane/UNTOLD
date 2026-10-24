// What customers see on the "What's new" page.
// To announce an update: add a new entry at the TOP of UPDATES with a new, unique `id`.
// Everyone then sees a small star on the "What's new" button until they open the page.

export type UpdateEntry = {
  id: string; // change this for every new update, e.g. '2026-11-02'
  date: string; // shown to readers
  title: string;
  items: { title: string; text: string }[];
};

export const UPDATES: UpdateEntry[] = [
  {
    id: '2026-10-24',
    date: '24 October 2026',
    title: 'Predictions and profile photos',
    items: [
      {
        title: 'Predictions on every story',
        text: 'Authors can ask \u201cWhat happens next?\u201d on their stories. Pick the answer you think is right, see how other readers voted, and find out who called it once the author reveals the real answer. Predictions sit above the Theory Room, so it is easy to tell them apart: predictions are quick picks, theories are your own ideas.',
      },
      {
        title: 'Your profile photo shows up everywhere',
        text: 'When you update your photo, it now appears next to your name on theories, replies and in the Community section, not just on your profile. Authors\u2019 photos also show on their stories, and names appear correctly in the Community Theory Room.',
      },
    ],
  },
];

export const LATEST_UPDATE_ID = UPDATES[0].id;
export const SEEN_KEY = 'untold.whats-new.seen';
export const SEEN_EVENT = 'untold:whats-new-seen';
