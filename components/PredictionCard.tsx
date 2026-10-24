'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Check, Lock, Sparkles, Trophy } from 'lucide-react';
import { votePercent, type PollView } from '@/lib/polls';

// "What happens next?" for one story. The author turns it on in the Creator Studio and chooses the options.
// Readers pick one (and can change their pick until voting closes). Results appear once you've picked, so they
// can't sway you. When the author reveals the real answer, everyone sees who called it.

export default function PredictionCard({
  storyId,
  signedIn,
  onNotice,
}: {
  storyId: string;
  signedIn: boolean;
  onNotice: (message: string) => void;
}) {
  // undefined = still loading, null = this story has no prediction
  const [poll, setPoll] = useState<PollView | null | undefined>(undefined);
  const [busyOption, setBusyOption] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/polls?storyId=${encodeURIComponent(storyId)}`, { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      setPoll(response.ok ? ((body.poll as PollView | null) ?? null) : null);
    } catch {
      setPoll(null);
    }
  }, [storyId]);

  useEffect(() => {
    setPoll(undefined);
    setChanging(false);
    void load();
  }, [load]);

  async function choose(optionId: string) {
    if (!poll || busyOption) return;
    if (!signedIn) {
      onNotice('Sign in to make a prediction.');
      return;
    }
    const wasChange = poll.myOptionId !== null;
    setBusyOption(optionId);
    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pollId: poll.id, optionId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        onNotice(body.error || 'Could not save your prediction.');
        await load();
        return;
      }
      setChanging(false);
      await load();
      onNotice(wasChange ? 'Prediction updated.' : 'Prediction locked in.');
    } catch {
      onNotice('Could not save your prediction.');
    } finally {
      setBusyOption(null);
    }
  }

  if (poll === undefined) {
    return <section className="predict-card predict-loading" aria-busy="true" aria-label="Loading prediction" />;
  }
  if (poll === null) return null;

  const isOpen = poll.status === 'open';
  const picked = poll.myOptionId;
  const canPick = isOpen && !poll.isAuthor && (picked === null || changing);
  const correct = poll.options.find((option) => option.id === poll.correctOptionId) ?? null;
  const pickedOption = poll.options.find((option) => option.id === picked) ?? null;

  const statusLabel = poll.resolved ? 'ANSWER REVEALED' : isOpen ? 'VOTING OPEN' : 'VOTING CLOSED';

  return (
    <section className="predict-card" aria-labelledby={`predict-q-${poll.id}`}>
      <div className="predict-heading">
        <p className="eyebrow muted-eyebrow"><Sparkles size={13} /> PREDICT WHAT HAPPENS NEXT</p>
        <span className={`predict-status ${poll.resolved ? 'is-resolved' : isOpen ? 'is-open' : 'is-closed'}`}>
          {!isOpen && !poll.resolved ? <Lock size={11} /> : null}
          {statusLabel}
        </span>
      </div>

      <h2 id={`predict-q-${poll.id}`} className="predict-question">{poll.question}</h2>

      {canPick ? (
        <div className="predict-options" role="radiogroup" aria-label={poll.question}>
          {poll.options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={picked === option.id}
              className={`predict-option${picked === option.id ? ' is-picked' : ''}`}
              disabled={busyOption !== null}
              onClick={() => void choose(option.id)}
            >
              <span className="predict-radio" aria-hidden="true" />
              <span className="predict-label">{option.label}</span>
              {busyOption === option.id ? <span className="predict-saving">Saving…</span> : picked === option.id ? <span className="predict-saving">Current pick</span> : null}
            </button>
          ))}
        </div>
      ) : (
        <ul className="predict-results">
          {poll.options.map((option) => {
            const percent = votePercent(option.votes, poll.totalVotes);
            const isCorrect = poll.correctOptionId === option.id;
            const isMine = picked === option.id;
            const isWrongPick = poll.resolved && isMine && !isCorrect;
            return (
              <li key={option.id} className={`predict-result${isMine ? ' is-picked' : ''}${isCorrect ? ' is-correct' : ''}${isWrongPick ? ' is-wrong' : ''}`}>
                <div className="predict-result-top">
                  <span className="predict-label">
                    {option.label}
                    {isMine ? <em className="predict-tag">Your pick</em> : null}
                    {isCorrect ? <em className="predict-tag is-correct"><Check size={11} /> Correct</em> : null}
                  </span>
                  {option.votes !== null ? <span className="predict-percent">{percent}%</span> : null}
                </div>
                {option.votes !== null ? (
                  <div className="predict-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="predict-foot">
        {poll.isAuthor ? (
          <p>This is your prediction. <Link href="/write">Manage it in the Creator Studio</Link>.</p>
        ) : poll.resolved ? (
          <p className={picked ? (picked === poll.correctOptionId ? 'predict-win' : '') : ''}>
            {picked ? (
              picked === poll.correctOptionId ? (
                <><Trophy size={14} /> You called it!</>
              ) : (
                <>Not quite. The answer was &ldquo;{correct?.label}&rdquo;.</>
              )
            ) : (
              <>The answer was &ldquo;{correct?.label}&rdquo;.</>
            )}
          </p>
        ) : !isOpen ? (
          <p>Voting is closed{pickedOption ? <>. You predicted &ldquo;{pickedOption.label}&rdquo;</> : null}. The author will reveal the answer after the next part.</p>
        ) : !signedIn ? (
          <p>Sign in to make your prediction.</p>
        ) : picked && !changing ? (
          <p>
            You predicted &ldquo;{pickedOption?.label}&rdquo;.{' '}
            <button type="button" className="predict-link" onClick={() => setChanging(true)}>Change my pick</button>
          </p>
        ) : changing ? (
          <p><button type="button" className="predict-link" onClick={() => setChanging(false)}>Keep my current pick</button></p>
        ) : (
          <p>Choose one. You can change your pick until voting closes.</p>
        )}
        {poll.totalVotes !== null ? <span className="predict-total">{poll.totalVotes} {poll.totalVotes === 1 ? 'prediction' : 'predictions'}</span> : null}
      </div>
    </section>
  );
}
