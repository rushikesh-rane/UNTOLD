import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { DM_Mono, DM_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import './dark-theme.css';
import NavigationProgress from '@/components/NavigationProgress';
import GuestSignInNudge from '@/components/GuestSignInNudge';
import WelcomeTutorial from '@/components/WelcomeTutorial';

// Self-hosted at build time: no request to Google at runtime and no render-blocking CSS @import.
const sans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' });
const mono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap', variable: '--font-dm-mono' });
const serif = Playfair_Display({ subsets: ['latin'], style: ['normal', 'italic'], display: 'swap', variable: '--font-playfair' });

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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#121116' },
  ],
  colorScheme: 'light dark',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Reading the request headers makes every page render per request. That is required for the
  // Content-Security-Policy: its nonce (set in middleware.ts) is different on every request, and Next.js
  // can only stamp it on its scripts when the page is rendered for that request.
  await headers();

  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint. A file (public/theme-init.js), not inline code, so the CSP stays strict. */}
        {/* Synchronous on purpose: it must run before the first paint to avoid a flash of the wrong theme. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body>
        <NavigationProgress />
        {children}
        <GuestSignInNudge />
        <WelcomeTutorial />
      </body>
    </html>
  );
}