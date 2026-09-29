'use client';

import { UserMenu } from '@/components/UserMenu';
import { NotificationBell } from '@/components/NotificationBell';

/** Top bar for signed-in app pages: brand, language toggle, notifications, account menu. */
export function AppHeader({ lang, setLang }: { lang: 'en' | 'ko'; setLang: (l: 'en' | 'ko') => void }) {
  return (
    <header className="app-nav">
      <div className="wrap app-nav-in">
        <a className="app-brand" href="/">
          Doreham <span className="app-ko-mark">도레함</span>
        </a>
        <div className="app-nav-right">
          <div className="app-toggle" role="group" aria-label="Language">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')} aria-label="한국어">
              <span className="long">한국어</span>
              <span className="short">한</span>
            </button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')} aria-label="English">
              <span className="long">English</span>
              <span className="short">EN</span>
            </button>
          </div>
          <NotificationBell lang={lang} />
          <UserMenu lang={lang} />
        </div>
      </div>
      <style jsx>{`
        .app-nav { position: sticky; top: 0; z-index: 40; background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .app-nav-in { display: flex; align-items: center; gap: 16px; height: 64px; }
        .app-brand { display: flex; align-items: baseline; gap: 8px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .app-ko-mark { color: var(--ink-60); font-weight: 700; font-size: 16px; }
        .app-nav-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }
        .app-toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .app-toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 12.5px; padding: 6px 11px; cursor: pointer; color: var(--ink-60); white-space: nowrap; }
        .short { display: none; }
        .app-toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        @media (max-width: 560px) {
          .app-ko-mark { display: none; }
          .app-nav-right { gap: 6px; }
          .app-toggle button { padding: 6px 10px; font-size: 12px; }
          .long { display: none; }
          .short { display: inline; }
        }
      `}</style>
    </header>
  );
}
