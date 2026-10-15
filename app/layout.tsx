import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UNTOLD — Every story has another side',
  description: 'Read a little. Guess a lot. Discover the truth. UNTOLD is a suspense-driven storytelling experience where readers share theories before the reveal.',
  applicationName: 'UNTOLD',
  openGraph: {
    title: 'UNTOLD — Every story has another side',
    description: 'Read a little. Guess a lot. Discover the truth.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'UNTOLD — Every story has another side',
    description: 'Read a little. Guess a lot. Discover the truth.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
