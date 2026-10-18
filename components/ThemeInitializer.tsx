'use client';

import { useEffect } from 'react';

/** Applies the saved UNTOLD theme on every route before the user interacts. */
export default function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = window.localStorage.getItem('untold.theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = (savedTheme ? savedTheme === 'dark' : prefersDark) ? 'dark' : 'light';
  }, []);

  return null;
}
