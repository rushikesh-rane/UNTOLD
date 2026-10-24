'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { LATEST_UPDATE_ID, SEEN_EVENT, SEEN_KEY } from '@/lib/whats-new';

// A small "What's new" button for the top bar. A star appears on it when there is an update the person has not
// opened yet, and goes away once they open the page. (Remembered per browser.)

export default function WhatsNewLink() {
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    const check = () => {
      try {
        setUnseen(window.localStorage.getItem(SEEN_KEY) !== LATEST_UPDATE_ID);
      } catch {
        setUnseen(false);
      }
    };
    check();
    window.addEventListener(SEEN_EVENT, check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener(SEEN_EVENT, check);
      window.removeEventListener('storage', check);
    };
  }, []);

  return (
    <Link href="/whats-new" className="profile-button whats-new-link" aria-label={unseen ? "What's new (new update)" : "What's new"} title="What's new in UNTOLD">
      <Sparkles size={17} />
      <span>What&rsquo;s new</span>
      {unseen ? <span className="whats-new-star" aria-hidden="true">&#9733;</span> : null}
    </Link>
  );
}
