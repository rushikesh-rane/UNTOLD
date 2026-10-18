'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// Thin bar across the top while a page change is in flight. Starts on clicks of internal
// links (capture phase, so it runs before Next's own handler) and finishes when the path changes.
export default function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const safety = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(safety.current);
    setState((current) => (current === 'loading' ? 'done' : current));
    const reset = window.setTimeout(() => setState('idle'), 450);
    return () => window.clearTimeout(reset);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor || !anchor.href || anchor.hasAttribute('download')) return;
      if (anchor.target && anchor.target !== '_self') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      window.clearTimeout(safety.current);
      setState('loading');
      // If the navigation never completes (cancelled, error), don't leave the bar hanging.
      safety.current = window.setTimeout(() => setState('idle'), 10000);
    }
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(safety.current);
    };
  }, []);

  return <div className={`nav-progress nav-progress-${state}`} aria-hidden="true" />;
}
