
import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'UNTOLD — Stories & Secrets',
    short_name: 'UNTOLD',
    description: 'Read a little. Guess a lot. Discover the truth.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fbf8f5',
    theme_color: '#fbf8f5',
    orientation: 'portrait-primary',
    categories: ['books', 'entertainment'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
