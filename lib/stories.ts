export type Story = {
  id: string;
  category: string; // the story's genre, upper-cased (e.g. 'MYSTERY', 'REAL LIFE')
  title: string;
  excerpt: string;
  author: string;
  handle: string;
  initials: string;
  color: string;
  readTime: string;
  predictions: number;
  comments: number;
  reveal: string;
  progress: number;
  featured?: boolean;
};

export const stories: Story[] = [
  {
    id: 'blue-tick',
    category: 'REAL LIFE',
    title: 'The blue tick at 2:13 AM',
    excerpt: 'He said he was asleep. Then I checked the one thing he forgot to turn off…',
    author: 'Mira S.',
    handle: '@mirawrites',
    initials: 'MS',
    color: 'rose',
    readTime: '3 min read',
    predictions: 284,
    comments: 96,
    reveal: 'Reveal in 04:38:12',
    progress: 68,
    featured: true,
  },
  {
    id: 'room-09',
    category: 'FICTION',
    title: 'Room 09 doesn’t exist',
    excerpt: 'The hotel had eight floors. So why did the elevator stop at nine—and open?',
    author: 'Noah Vale',
    handle: '@noahvale',
    initials: 'NV',
    color: 'violet',
    readTime: '5 min read',
    predictions: 173,
    comments: 58,
    reveal: 'Part II tomorrow',
    progress: 42,
  },
  {
    id: 'birthday',
    category: 'REAL LIFE',
    title: 'Everyone forgot my birthday. Or so I thought.',
    excerpt: 'By 10 PM, not one message. Then a stranger knocked on my door holding a photograph.',
    author: 'Aarav K.',
    handle: '@aaravk',
    initials: 'AK',
    color: 'amber',
    readTime: '4 min read',
    predictions: 121,
    comments: 44,
    reveal: 'Reveal in 1 day',
    progress: 81,
  },
];

export const popularTopics = [
  { label: 'Plot twists', count: '2.4k stories', icon: '✳' },
  { label: 'Relationships', count: '1.8k stories', icon: '♡' },
  { label: 'Unsolved mysteries', count: '986 stories', icon: '⌕' },
  { label: 'Confessions', count: '752 stories', icon: '◉' },
];
