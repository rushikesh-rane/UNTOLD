'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'untold-theme';
const META_COLORS = { light: '#f8f7f4', dark: '#121116' } as const;

type Theme = keyof typeof META_COLORS;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => {
      meta.removeAttribute('media');
      meta.setAttribute('content', META_COLORS[theme]);
    });
}

export default function ThemeToggle() {
  // null until mounted, so server and first client render match
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

    // Follow the OS setting live, unless the reader has made an explicit choice.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = (event: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        /* storage unavailable: fall through and follow the system */
      }
      const next: Theme = event.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };
    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, []);

  function toggle() {
    const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode etc.: the choice just won't persist */
    }
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={toggle}
      aria-label={theme === null ? 'Toggle dark mode' : isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={theme === null ? undefined : isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Both icons are rendered; CSS picks one from html[data-theme], so there is no flash. */}
      <Moon className="theme-icon theme-icon-moon" size={18} aria-hidden="true" />
      <Sun className="theme-icon theme-icon-sun" size={18} aria-hidden="true" />
    </button>
  );
}
