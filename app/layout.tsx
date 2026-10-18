import type { Metadata, Viewport } from 'next';
import './globals.css';
import './dark-theme.css';

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

// Runs before first paint so the saved (or system) theme is applied with no flash.
const themeInitScript = `(function(){try{var t=localStorage.getItem('untold-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}var d=document.documentElement;d.dataset.theme=t;d.style.colorScheme=t;document.addEventListener('DOMContentLoaded',function(){var c=t==='dark'?'#121116':'#f8f7f4';document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.removeAttribute('media');m.setAttribute('content',c)})})}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}