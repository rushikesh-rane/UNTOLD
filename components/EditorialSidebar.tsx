'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Compass,
  Heart,
  Bookmark,
  Bell,
  UserRound,
  Lightbulb,
} from 'lucide-react';

const items = [
  { href: '/', label: 'Discover', icon: Compass },
  { href: '/community?tab=following', label: 'Following', icon: Heart },
  { href: '/community?tab=reading-list', label: 'Reading list', icon: Bookmark },
  { href: '/community?tab=theories', label: 'Theory Room', icon: Lightbulb },
  { href: '/community?tab=predictions', label: 'Predictions', icon: Bell },
];

// useSearchParams needs a Suspense boundary on statically rendered pages (e.g. /how-it-works),
// so the sidebar renders without a tab first and fills it in once the URL is available.
export default function EditorialSidebar() {
  return (
    <Suspense fallback={<SidebarContent tab={null} />}>
      <SidebarWithTab />
    </Suspense>
  );
}

function SidebarWithTab() {
  const tab = useSearchParams().get('tab');
  return <SidebarContent tab={tab} />;
}

function SidebarContent({ tab }: { tab: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="editorial-sidebar" aria-label="Main navigation">
      <Link href="/" className="editorial-brand">
        <span className="brand-mark">
          <BookOpen size={19} />
        </span>
        <span className="brand-word">
          un<span>told</span><i>.</i>
        </span>
      </Link>

      <p className="editorial-sidebar-label">YOUR SPACE</p>

      <nav className="editorial-nav" aria-label="Your space">
        {items.map(({ href, label, icon: Icon }) => {
          const [targetPath, query = ''] = href.split('?');
          const targetTab = new URLSearchParams(query).get('tab');
          // Discover matches the home page; community links must match both the path and ?tab=
          // (the community page opens on Reading list when no tab is given).
          const active =
            label === 'Discover'
              ? pathname === '/'
              : pathname === targetPath && (tab ?? 'reading-list') === targetTab;

          return (
            <Link
              key={label}
              href={href}
              className={`editorial-nav-link${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <p className="editorial-sidebar-label editorial-corner-label">
        YOUR CORNER
      </p>

      

      <Link
        href="/account"
        className="editorial-profile"
        aria-current={pathname === '/account' ? 'page' : undefined}
      >
        <span className="editorial-profile-avatar">
          <UserRound size={16} aria-hidden="true" />
        </span>
        <span>
          <strong>Your profile</strong>
          <small>Make your mark</small>
        </span>
        <span className="editorial-profile-chevron" aria-hidden="true">
          ⌄
        </span>
      </Link>
    </aside>
  );
}