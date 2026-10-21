'use client';

import { useEffect, useRef } from 'react';

// Cloudflare Turnstile: a privacy-friendly CAPTCHA that is usually invisible. It only appears when
// NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. The token it produces is sent to Supabase Auth, which verifies it
// server-side once CAPTCHA protection is switched on in the Supabase dashboard (see docs/SECURITY-CHECKLIST.md).

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function Turnstile({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
  /** Change this value to get a fresh challenge (tokens can only be used once). */
  resetKey?: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let cancelled = false;

    function mount() {
      if (cancelled || !container.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(null),
        'error-callback': () => onTokenRef.current(null),
      });
    }

    let script: HTMLScriptElement | null = null;
    if (window.turnstile) {
      mount();
    } else {
      script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (!script) {
        script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', mount);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener('load', mount);
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === undefined || !widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
    onTokenRef.current(null);
  }, [resetKey]);

  return <div ref={container} className="turnstile-box" />;
}
