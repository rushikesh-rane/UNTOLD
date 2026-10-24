'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { LATEST_UPDATE_ID, SEEN_EVENT, SEEN_KEY, UPDATES } from '@/lib/whats-new';

export default function WhatsNewPage() {
  // Opening this page counts as seeing the update, so the star on the button goes away.
  useEffect(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, LATEST_UPDATE_ID);
    } catch {
      /* private mode: the star simply shows again next time */
    }
    window.dispatchEvent(new Event(SEEN_EVENT));
  }, []);

  return (
    <main className="whats-new-page">
      <Link href="/" className="creator-back"><ArrowLeft size={16} /> Back to Discover</Link>
      <header className="whats-new-header">
        <p className="eyebrow muted-eyebrow"><Sparkles size={13} /> WHAT&rsquo;S NEW</p>
        <h1>Fresh in <em>UNTOLD.</em></h1>
        <p>The latest things we have added for readers and storytellers.</p>
      </header>

      {UPDATES.map((update, index) => (
        <section className="whats-new-update" key={update.id} aria-labelledby={`update-${update.id}`}>
          <div className="whats-new-meta">
            <span>{update.date}</span>
            {index === 0 ? <span className="whats-new-badge">LATEST</span> : null}
          </div>
          <h2 id={`update-${update.id}`}>{update.title}</h2>
          <ul>
            {update.items.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
