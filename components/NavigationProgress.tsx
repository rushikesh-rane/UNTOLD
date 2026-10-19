'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// Thin bar across the top that shows whenever something is loading:
//  - a page change (starts on clicks of internal links, finishes when the path changes), and
//  - any network request the app makes (uploads, saves, loading stories, router.refresh()).
// It is NOT tied to scrolling. Requests that finish within SHOW_DELAY ms never show the bar,
// so quick calls don't make it flicker.
const SHOW_DELAY = 150;

export default function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const navPending = useRef(false);
  const inflight = useRef(0);
  const showTimer = useRef<number | undefined>(undefined);
  const navSafety = useRef<number | undefined>(undefined);

  // Re-evaluates whether anything is loading and shows or finishes the bar accordingly.
  const update = useCallback((immediate = false) => {
    const active = navPending.current || inflight.current > 0;
    if (active) {
      if (showTimer.current === undefined) {
        showTimer.current = window.setTimeout(() => {
          showTimer.current = undefined;
          if (navPending.current || inflight.current > 0) setState('loading');
        }, immediate ? 0 : SHOW_DELAY);
      }
    } else {
      window.clearTimeout(showTimer.current);
      showTimer.current = undefined;
      setState((current) => (current === 'loading' ? 'done' : current));
    }
  }, []);

  // After finishing, fade out and reset to idle.
  useEffect(() => {
    if (state !== 'done') return;
    const reset = window.setTimeout(() => setState('idle'), 450);
    return () => window.clearTimeout(reset);
  }, [state]);

  // The route changed: the navigation is complete.
  useEffect(() => {
    window.clearTimeout(navSafety.current);
    navPending.current = false;
    update();
  }, [pathname, update]);

  // Internal link clicks start the bar immediately (capture phase, before Next's own handler).
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor || !anchor.href || anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      window.clearTimeout(navSafety.current);
      navPending.current = true;
      update(true);
      // If the navigation never completes (cancelled, error), don't leave the bar hanging.
      navSafety.current = window.setTimeout(() => { navPending.current = false; update(); }, 10000);
    }
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(navSafety.current);
    };
  }, [update]);

  // Track network requests so uploads, saves and data loads show the bar too.
  useEffect(() => {
    const original = window.fetch;

    function shouldTrack(input: RequestInfo | URL, init?: RequestInit) {
      try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/_next/') || url.includes('__nextjs')) return false;
        const headers = new Headers(init?.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
        // Next.js link prefetching happens in the background; it isn't something the person is waiting on.
        if (headers.has('next-router-prefetch') || headers.has('next-hmr-refresh')) return false;
      } catch { /* If in doubt, track it. */ }
      return true;
    }

    const tracked = function (this: unknown, input: RequestInfo | URL, init?: RequestInit) {
      if (!shouldTrack(input, init)) return original.call(window, input, init);
      inflight.current += 1;
      update();
      return original.call(window, input, init).finally(() => {
        inflight.current = Math.max(0, inflight.current - 1);
        update();
      });
    } as typeof window.fetch;

    window.fetch = tracked;
    return () => {
      if (window.fetch === tracked) window.fetch = original;
      inflight.current = 0;
      window.clearTimeout(showTimer.current);
      showTimer.current = undefined;
    };
  }, [update]);

  return <div className={`nav-progress nav-progress-${state}`} aria-hidden="true" />;
}
