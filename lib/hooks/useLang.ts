'use client';

import { useCallback, useEffect, useState } from 'react';

export type Lang = 'en' | 'ko';
const STORAGE_KEY = 'doreham_lang';

/**
 * The UI language, remembered across pages and reloads (localStorage, same key the
 * questions page already uses). Falls back to <body data-lang>, then English.
 */
export function useLang(): readonly [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* private mode */
    }
    const fromBody = document.body.getAttribute('data-lang');
    const initial: Lang = stored === 'ko' || stored === 'en' ? stored : fromBody === 'ko' ? 'ko' : 'en';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after hydration
    setLangState(initial);
    document.body.setAttribute('data-lang', initial);
    document.documentElement.lang = initial;
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* private mode */
    }
    document.body.setAttribute('data-lang', l);
    document.documentElement.lang = l;
  }, []);

  return [lang, setLang] as const;
}
