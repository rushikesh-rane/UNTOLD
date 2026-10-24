// The shape of a story as the Discover feed and reader display it (built from /api/stories).
export type Story = {
  id: string;
  category: string; // the story's genre, upper-cased (e.g. 'MYSTERY', 'REAL LIFE')
  title: string;
  excerpt: string;
  author: string;
  handle: string;
  initials: string;
  avatarUrl?: string;
  color: string;
  readTime: string;
  predictions: number;
  comments: number;
  reveal: string;
  progress: number;
  featured?: boolean;
};
