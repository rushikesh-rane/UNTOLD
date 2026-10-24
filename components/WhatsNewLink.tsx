'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { SEEN_EVENT } from '@/lib/whats-new';
import { hasUnseenUpdate } from '@/lib/whats-new-client';
import { createClient } from '@/lib/supabase/client';

// "bar": the button in the top bar (hidden on phones, where there is no room).
// "chip": a small pill shown on phones at the top of the feed instead.
// A star shows while the signed-in account has an update it has not opened yet; opening the page clears it.

export default function WhatsNewLink({ variant = 'bar' }: { variant?: 'bar' | 'chip' }) {
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () => { void hasUnseenUpdate().then((value) => { if (alive) setUnseen(value); }); };
    check();
    // Signing in, signing out or switching accounts re-checks straight away.
    const { data: listener } = createClient().auth.onAuthStateChange(() => check());
    window.addEventListener(SEEN_EVENT, check);
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      window.removeEventListener(SEEN_EVENT, check);
    };
  }, []);

  const label = unseen ? "What's new (new update)" : "What's new";
  if (variant === 'chip') {
    return (
      <Link href="/whats-new" className="whats-new-chip" aria-label={label}>
        <Sparkles size={14} /> What&rsquo;s new{unseen ? <span className="whats-new-star-inline" aria-hidden="true">&#9733;</span> : null}
      </Link>
    );
  }
  return (
    <Link href="/whats-new" className="profile-button whats-new-link" aria-label={label} title="What's new in UNTOLD">
      <Sparkles size={17} />
      <span>What&rsquo;s new</span>
      {unseen ? <span className="whats-new-star" aria-hidden="true">&#9733;</span> : null}
    </Link>
  );
}
