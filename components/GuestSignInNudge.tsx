'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Lock, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { canShowGuestNudge, GUEST_NUDGE_AFTER_SECONDS } from '@/lib/guest';

// Once per visit, after a guest has used the site for a while, ask them to sign in: a popup with the rest of
// the page blurred out behind it. They can close it (X, "Maybe later", Escape, or a click outside) and carry on.
// "Per visit" = per browser tab session, so it comes back the next time they open the site.
// How long it waits, and which pages it may appear on, is decided in lib/guest.ts.

const STORAGE_KEY = 'untold:guest-nudge';

type NudgeState = { seconds: number; done: boolean };

function readState(): NudgeState {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<NudgeState>;
    return { seconds: Number(parsed.seconds) || 0, done: parsed.done === true };
  } catch {
    return { seconds: 0, done: false };
  }
}

function writeState(state: NudgeState) {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode: it just resets next time */ }
}

export default function GuestSignInNudge() {
  const pathname = usePathname();
  const [isGuest, setIsGuest] = useState(false);
  const [open, setOpen] = useState(false);
  const [nextPath, setNextPath] = useState('/');
  const rootRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLAnchorElement>(null);

  const eligible = isGuest && canShowGuestNudge(pathname);

  // Is this visitor signed in? Reads the saved session (no network call) and follows sign-in / sign-out.
  useEffect(() => {
    const supabase = (() => { try { return createClient(); } catch { return null; } })();
    if (!supabase) return; // Supabase not configured: never nag.
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => { if (alive) setIsGuest(!data.session); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setIsGuest(!session); });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  // Count the seconds a guest is actually looking at the site (a hidden tab does not count). The count survives
  // page navigation and reloads within the visit, so moving around does not reset the clock.
  useEffect(() => {
    if (!eligible) return;
    const state = readState();
    if (state.done) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      state.seconds += 1;
      if (state.seconds >= GUEST_NUDGE_AFTER_SECONDS) {
        window.clearInterval(timer);
        setNextPath(`${window.location.pathname}${window.location.search}`);
        setOpen(true);
      }
      writeState(state);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [eligible]);

  // Signing in (or leaving for a page that must not show it) closes the popup.
  useEffect(() => { if (!eligible) setOpen(false); }, [eligible]);

  const close = useCallback(() => {
    writeState({ seconds: GUEST_NUDGE_AFTER_SECONDS, done: true }); // dismissed: no more popups this visit
    setOpen(false);
  }, []);

  // While it is open: lock scrolling, make everything behind it unreachable (mouse, keyboard and screen readers),
  // move focus into the box, close on Escape, and put focus back where it was afterwards.
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
    primaryRef.current?.focus();

    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      inerted.forEach((el) => el.removeAttribute('inert'));
      previouslyFocused?.focus?.();
    };
  }, [open, close]);

  return (
    <div ref={rootRef} data-guest-nudge="">
      {open ? (
        <div className="guest-modal-backdrop guest-nudge-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div className="guest-modal" role="dialog" aria-modal="true" aria-labelledby="guest-nudge-title" aria-describedby="guest-nudge-text">
            <button type="button" className="guest-modal-close" onClick={close} aria-label="Close"><X size={18} /></button>
            <span className="guest-modal-icon"><Lock size={18} /></span>
            <h2 id="guest-nudge-title">Enjoying <span className="guest-nudge-brand">untold</span>?</h2>
            <p id="guest-nudge-text">Sign in or create a free account to read every part of a story, save your favourites, follow creators, and share your own theories.</p>
            <Link ref={primaryRef} href={`/login?next=${encodeURIComponent(nextPath)}`} className="guest-primary" onClick={close}>Sign in or create an account <ArrowRight size={15} /></Link>
            <button type="button" className="guest-modal-secondary" onClick={close}>Maybe later</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
