'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Lightbulb, PenLine, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// Two things happen right after someone signs in:
//   1. A small toast with a tick: "You're logged in".
//   2. A short tutorial (first sign-in only, per account on this browser) covering the basics:
//      finding and reading a story, saving it, sharing a theory, and writing your own.
// The tutorial can be skipped at any time, and replayed from the "How it works" page
// (that page's button fires the OPEN_EVENT below).

export const OPEN_TUTORIAL_EVENT = 'untold:open-tutorial';

const SEEN_KEY = 'untold:tutorial-seen:'; // + user id, in localStorage: shown once per account per browser
const WELCOMED_KEY = 'untold:welcomed:'; // + user id, in sessionStorage: one tick per browser tab session
const TOAST_MS = 2600;

const steps = [
  {
    icon: Compass,
    title: 'Find a story',
    text: 'Discover is your home page. Browse the feed, use the tabs and search to find something that catches your eye, then open it.',
  },
  {
    icon: BookOpen,
    title: 'Read it, part by part',
    text: 'Open a story to read its first part. Later parts can unlock over time, so come back for the reveal. Tap “Save story” to keep it in your Reading list.',
  },
  {
    icon: Lightbulb,
    title: 'Share your theory',
    text: 'Think you know what really happened? Post your theory under the story, like and reply to other readers’ theories, and browse them all in the Theory Room.',
  },
  {
    icon: PenLine,
    title: 'Write your own',
    text: 'Tap “Write a story”, give it a title and a first part, use “Add part” for more, then “Save draft” while you work or “Publish story” when it is ready.',
  },
];

export default function WelcomeTutorial() {
  const [toast, setToast] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const userIdRef = useRef<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);

  const markSeen = useCallback(() => {
    const id = userIdRef.current;
    if (!id) return;
    try { window.localStorage.setItem(SEEN_KEY + id, '1'); } catch { /* private mode: it may show again next time */ }
  }, []);

  const close = useCallback(() => {
    markSeen();
    setOpen(false);
  }, [markSeen]);

  const openTutorial = useCallback(() => { setStep(0); setOpen(true); }, []);

  // Watch for a fresh sign-in.
  useEffect(() => {
    const supabase = (() => { try { return createClient(); } catch { return null; } })();
    if (!supabase) return; // Supabase not configured: nothing to do.
    let alive = true;
    let toastTimer: number | undefined;
    let tutorialTimer: number | undefined;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (!session) { userIdRef.current = null; return; }
      userIdRef.current = session.user.id;
      if (event !== 'SIGNED_IN') return;

      // Supabase can repeat SIGNED_IN (e.g. when a tab regains focus), so only celebrate once per tab session.
      try {
        if (window.sessionStorage.getItem(WELCOMED_KEY + session.user.id)) return;
        window.sessionStorage.setItem(WELCOMED_KEY + session.user.id, '1');
      } catch { /* storage blocked: fall through and show it */ }

      setToast(true);
      toastTimer = window.setTimeout(() => setToast(false), TOAST_MS);

      let seen = false;
      try { seen = window.localStorage.getItem(SEEN_KEY + session.user.id) === '1'; } catch { /* treat as not seen */ }
      if (!seen) tutorialTimer = window.setTimeout(() => { if (alive) openTutorial(); }, TOAST_MS + 300);
    });

    void supabase.auth.getSession().then(({ data }) => { if (alive && data.session) userIdRef.current = data.session.user.id; });

    const onOpen = () => openTutorial();
    window.addEventListener(OPEN_TUTORIAL_EVENT, onOpen);

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
      window.removeEventListener(OPEN_TUTORIAL_EVENT, onOpen);
      window.clearTimeout(toastTimer);
      window.clearTimeout(tutorialTimer);
    };
  }, [openTutorial]);

  // While the tutorial is open: lock scrolling, make the page behind it unreachable, close on Escape,
  // use the arrow keys to move between steps, and put focus back afterwards.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const inerted: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child.contains(rootRef.current) || child.tagName === 'SCRIPT' || child.tagName.toLowerCase() === 'next-route-announcer') continue;
      if (!child.hasAttribute('inert')) { child.setAttribute('inert', ''); inerted.push(child); }
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowRight') setStep((s) => Math.min(s + 1, steps.length - 1));
      else if (event.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      inerted.forEach((el) => el.removeAttribute('inert'));
      previouslyFocused?.focus?.();
    };
  }, [open, close]);

  useEffect(() => { if (open) primaryRef.current?.focus(); }, [open, step]);

  const current = steps[step];
  const Icon = current.icon;
  const last = step === steps.length - 1;

  return (
    <div ref={rootRef} data-welcome="">
      {toast ? (
        <div className="login-toast" role="status" aria-live="polite">
          <span className="login-toast-tick"><Check size={15} strokeWidth={3} /></span>
          You’re logged in
        </div>
      ) : null}

      {open ? (
        <div className="guest-modal-backdrop tutorial-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div className="guest-modal tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-text">
            <button type="button" className="guest-modal-close" onClick={close} aria-label="Close tutorial"><X size={18} /></button>
            <p className="tutorial-kicker">QUICK TOUR · {step + 1} OF {steps.length}</p>
            <span className="guest-modal-icon"><Icon size={20} /></span>
            <h2 id="tutorial-title">{current.title}</h2>
            <p id="tutorial-text">{current.text}</p>

            <div className="tutorial-dots" aria-hidden="true">
              {steps.map((item, index) => <span key={item.title} className={index === step ? 'active' : ''} />)}
            </div>

            <div className="tutorial-actions">
              {step > 0 ? (
                <button type="button" className="tutorial-back" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button>
              ) : (
                <button type="button" className="tutorial-back" onClick={close}>Skip</button>
              )}
              <button ref={primaryRef} type="button" className="guest-primary tutorial-next" onClick={() => (last ? close() : setStep(step + 1))}>
                {last ? <>Start exploring <Compass size={15} /></> : <>Next <ArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
