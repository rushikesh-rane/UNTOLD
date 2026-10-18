import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'UNTOLD — Every story has another side',
  description:
    'Read a little. Guess a lot. Discover the truth. UNTOLD is a suspense-driven storytelling experience where readers share theories before the reveal.',
  applicationName: 'UNTOLD',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'UNTOLD',
  },
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f8f7f4',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}