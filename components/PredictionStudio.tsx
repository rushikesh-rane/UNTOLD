'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { cleanPollInput, DEFAULT_POLL_QUESTION, POLL_LIMITS, votePercent, type PollView } from '@/lib/polls';

// The author's side of predictions. Turning it on means writing a question and choosing the options readers see.
// While nobody has voted the author can edit or remove it. Once readers have voted the options are frozen
// (so nobody's pick changes under them) and the author can close voting, then reveal which option was right.

type Mode = 'summary' | 'form' | 'reveal';

export default function PredictionStudio({
  storyId,
  published,
  notify,
}: {
  storyId: string | null;
  published: boolean;
  notify: (message: string) => void;
}) {
  const [poll, setPoll] = useState<PollView | null | undefined>(undefined);
  const [mode, setMode] = useState<Mode>('summary');
  const [question, setQuestion] = useState(DEFAULT_POLL_QUESTION);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [revealChoice, setRevealChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!storyId) {
      setPoll(null);
      return;
    }
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
    setMode('summary');
    setRevealChoice(null);
    void load();
  }, [load]);

  function startNewForm() {
    setQuestion(DEFAULT_POLL_QUESTION);
    setOptions(['', '']);
    setMode('form');
  }

  function startEditForm(current: PollView) {
    setQuestion(current.question);
    setOptions(current.options.map((option) => option.label));
    setMode('form');
  }

  async function send(method: 'PUT' | 'PATCH' | 'DELETE', url: string, body: unknown, success: string) {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(result.error || 'Something went wrong. Please try again.');
        return false;
      }
      notify(success);
      await load();
      setMode('summary');
      setRevealChoice(null);
      return true;
    } catch {
      notify('Something went wrong. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  function savePoll() {
    if (!storyId) return;
    const cleaned = cleanPollInput(question, options);
    if ('error' in cleaned) {
      notify(cleaned.error);
      return;
    }
    void send('PUT', '/api/polls', { storyId, question: cleaned.question, options: cleaned.options }, 'Prediction saved. Readers can now make their picks.');
  }

  const total = poll?.totalVotes ?? 0;

  return (
    <div className="pstudio">
      {!storyId ? (
        <div className="pstudio-note">
          <Sparkles size={16} />
          <p>Save your story as a draft first. Then you can add a prediction that readers vote on.</p>
        </div>
      ) : poll === undefined ? (
        <div className="pstudio-note" aria-busy="true"><p>Loading…</p></div>
      ) : mode === 'form' || (poll === null && mode === 'summary') ? (
        <>
          {poll === null ? (
            <p className="pstudio-intro">
              Optional. Ask readers what they think happens next and choose the answers they can pick from. After the next part is out, you reveal the real answer and everyone sees who called it.
            </p>
          ) : null}
          <label className="creator-label" htmlFor="pstudio-question">THE QUESTION</label>
          <input
            id="pstudio-question"
            className="creator-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={POLL_LIMITS.questionMax}
            placeholder="What happens next?"
          />

          <span className="creator-label">THE OPTIONS READERS CAN PICK ({options.filter((o) => o.trim()).length}/{POLL_LIMITS.optionsMax})</span>
          <div className="pstudio-options">
            {options.map((value, index) => (
              <div className="pstudio-option-row" key={index}>
                <span className="pstudio-index" aria-hidden="true">{index + 1}</span>
                <input
                  className="creator-input"
                  value={value}
                  aria-label={`Option ${index + 1}`}
                  maxLength={POLL_LIMITS.optionMax}
                  placeholder={index === 0 ? 'e.g. The knight returns' : index === 1 ? 'e.g. The queen was behind it' : 'Another possibility…'}
                  onChange={(event) => setOptions((current) => current.map((item, i) => (i === index ? event.target.value : item)))}
                />
                {options.length > POLL_LIMITS.optionsMin ? (
                  <button type="button" className="pstudio-icon-button" aria-label={`Remove option ${index + 1}`} onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}>
                    <X size={15} />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {options.length < POLL_LIMITS.optionsMax ? (
            <button type="button" className="creator-image-button" onClick={() => setOptions((current) => [...current, ''])}>
              <Plus size={15} /> Add an option
            </button>
          ) : null}
          <p className="creator-help">Readers pick one option and can change their pick until you close voting. Once anyone has voted, the options are locked.</p>

          <div className="pstudio-actions">
            <button type="button" className="creator-primary" disabled={busy} onClick={savePoll}>
              <Check size={16} /> {poll && poll.status === 'open' ? 'Save changes' : 'Open prediction for readers'}
            </button>
            {poll !== null ? (
              <button type="button" className="creator-secondary" disabled={busy} onClick={() => setMode('summary')}>Cancel</button>
            ) : null}
          </div>
        </>
      ) : poll ? (
        <>
          <div className="pstudio-summary-head">
            <span className={`predict-status ${poll.resolved ? 'is-resolved' : poll.status === 'open' ? 'is-open' : 'is-closed'}`}>
              {poll.resolved ? 'ANSWER REVEALED' : poll.status === 'open' ? 'VOTING OPEN' : 'VOTING CLOSED'}
            </span>
            <span className="pstudio-count">{total} {total === 1 ? 'prediction' : 'predictions'}</span>
          </div>
          <p className="pstudio-question">{poll.question}</p>

          {mode === 'reveal' ? (
            <>
              <p className="creator-help">Which option turned out to be right? Readers who picked it will see that they called it.</p>
              <div className="predict-options" role="radiogroup" aria-label="Which option was correct?">
                {poll.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={revealChoice === option.id}
                    className={`predict-option${revealChoice === option.id ? ' is-picked' : ''}`}
                    onClick={() => setRevealChoice(option.id)}
                  >
                    <span className="predict-radio" aria-hidden="true" />
                    <span className="predict-label">{option.label}</span>
                  </button>
                ))}
              </div>
              <div className="pstudio-actions">
                <button type="button" className="creator-primary" disabled={busy || !revealChoice} onClick={() => void send('PATCH', '/api/polls', { pollId: poll.id, action: 'resolve', optionId: revealChoice }, 'Answer revealed. Readers can now see who called it.')}>
                  <Check size={16} /> Reveal the answer
                </button>
                <button type="button" className="creator-secondary" disabled={busy} onClick={() => { setMode('summary'); setRevealChoice(null); }}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <ul className="predict-results">
                {poll.options.map((option) => {
                  const percent = votePercent(option.votes, poll.totalVotes);
                  const isCorrect = poll.correctOptionId === option.id;
                  return (
                    <li key={option.id} className={`predict-result${isCorrect ? ' is-correct' : ''}`}>
                      <div className="predict-result-top">
                        <span className="predict-label">
                          {option.label}
                          {isCorrect ? <em className="predict-tag is-correct"><Check size={11} /> Correct</em> : null}
                        </span>
                        <span className="predict-percent">{option.votes ?? 0} · {percent}%</span>
                      </div>
                      <div className="predict-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>
                    </li>
                  );
                })}
              </ul>

              {!published && poll.status === 'open' ? (
                <p className="creator-help">Readers can start predicting as soon as you publish this story.</p>
              ) : null}

              <div className="pstudio-actions">
                {poll.status === 'open' ? (
                  <>
                    {total === 0 ? (
                      <button type="button" className="creator-secondary" disabled={busy} onClick={() => startEditForm(poll)}>Edit</button>
                    ) : null}
                    <button type="button" className="creator-secondary" disabled={busy} onClick={() => void send('PATCH', '/api/polls', { pollId: poll.id, action: 'close' }, 'Voting closed.')}>Close voting</button>
                    <button type="button" className="creator-primary" disabled={busy || total === 0} title={total === 0 ? 'Nobody has voted yet' : undefined} onClick={() => setMode('reveal')}>Reveal the answer</button>
                    {total === 0 ? (
                      <button type="button" className="pstudio-danger" disabled={busy} onClick={() => void send('DELETE', `/api/polls?pollId=${encodeURIComponent(poll.id)}`, null, 'Prediction removed.')}>
                        <Trash2 size={14} /> Remove
                      </button>
                    ) : null}
                  </>
                ) : poll.resolved ? (
                  <button type="button" className="creator-primary" disabled={busy} onClick={startNewForm}>Start a new prediction</button>
                ) : (
                  <>
                    <button type="button" className="creator-primary" disabled={busy || total === 0} onClick={() => setMode('reveal')}>Reveal the answer</button>
                    <button type="button" className="creator-secondary" disabled={busy} onClick={() => void send('PATCH', '/api/polls', { pollId: poll.id, action: 'reopen' }, 'Voting reopened.')}>Reopen voting</button>
                    <button type="button" className="creator-secondary" disabled={busy} onClick={startNewForm}>Start a new prediction</button>
                  </>
                )}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
