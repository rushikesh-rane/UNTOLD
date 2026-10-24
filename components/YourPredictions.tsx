'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Check, Clock3, Lock, Sparkles, X } from 'lucide-react';
import type { MyPrediction } from '@/lib/polls';

// A reader's own record: every prediction they have made, and whether they called it.

type Payload = { entries: MyPrediction[]; score: { correct: number; answered: number } };

const STATUS: Record<MyPrediction['status'], { label: string; icon: React.ReactNode }> = {
  pending: { label: 'Waiting for the next part', icon: <Clock3 size={13} /> },
  closed: { label: 'Voting closed', icon: <Lock size={13} /> },
  correct: { label: 'You called it', icon: <Check size={13} /> },
  wrong: { label: 'Not this time', icon: <X size={13} /> },
};

export default function YourPredictions() {
  const [data, setData] = useState<Payload | null | undefined>(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/polls?mine=1', { cache: 'no-store' });
        const body = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error || 'Could not load your predictions.');
          setData(null);
          return;
        }
        setData(body as Payload);
      } catch {
        if (!cancelled) {
          setError('Could not load your predictions.');
          setData(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (data === undefined) return <p className="community-muted" aria-busy="true">Loading your predictions…</p>;
  if (data === null) return <p className="community-muted">{error}</p>;

  return (
    <>
      <p className="community-muted">When an author asks &ldquo;what happens next?&rdquo;, your pick is saved here. Once they reveal the answer, you will see whether you called it.</p>

      {data.score.answered > 0 ? (
        <p className="your-predictions-score">
          <Sparkles size={15} /> You have called <strong>{data.score.correct}</strong> of <strong>{data.score.answered}</strong> revealed {data.score.answered === 1 ? 'prediction' : 'predictions'}.
        </p>
      ) : null}

      {data.entries.length ? (
        <ul className="your-predictions">
          {data.entries.map((entry) => (
            <li key={entry.pollId} className={`your-prediction is-${entry.status}`}>
              <div>
                <Link href={`/?story=${encodeURIComponent(entry.storyId)}`} className="your-prediction-story">{entry.storyTitle}</Link>
                <p className="your-prediction-question">{entry.question}</p>
                <p className="your-prediction-pick">Your pick: <strong>{entry.myOption}</strong></p>
              </div>
              <span className={`your-prediction-status is-${entry.status}`}>{STATUS[entry.status].icon} {STATUS[entry.status].label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="community-empty">
          <Sparkles size={22} />
          <strong>No predictions yet</strong>
          <span>Open a story and look for &ldquo;Predict what happens next&rdquo;. Not every story has one: authors choose whether to ask.</span>
        </div>
      )}
    </>
  );
}
