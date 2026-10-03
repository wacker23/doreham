'use client';

import { usePathname } from 'next/navigation';
import { UserMenu } from '@/components/UserMenu';
import { NotificationBell } from '@/components/NotificationBell';
import { PushPrompt } from '@/components/PushPrompt';
import { useUser } from '@/lib/hooks/useUser';
import { appTabs, isTabActive } from '@/lib/appTabs';
import { isVenueAccount } from '@/lib/accountType';

/**
 * Top bar for signed-in app pages: brand, main sections (computers only; phones and tablets
 * use the bottom tab bar), language, notifications and the account menu.
 */
export function AppHeader({ lang, setLang }: { lang: 'en' | 'ko'; setLang: (l: 'en' | 'ko') => void }) {
  const pathname = usePathname() ?? '';
  const { user, profile } = useUser();

  return (
    <>
    <header className="app-nav">
      <div className="app-nav-in">
        <a className="app-brand" href="/">
          Doreham <span className="app-ko-mark">도레함</span>
        </a>
        {user && (
          <nav className="app-links" aria-label={lang === 'ko' ? '메뉴' : 'Main'}>
            {appTabs(user.id, isVenueAccount(profile)).map((t) => {
              const active = isTabActive(pathname, t);
              return (
                <a key={t.href} href={t.href} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined}>
                  <span aria-hidden="true">{t.icon}</span> {lang === 'ko' ? t.ko : t.en}
                </a>
              );
            })}
          </nav>
        )}
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
        .app-nav { position: sticky; top: 0; z-index: 40; background: rgba(245, 242, 235, 0.92); border-bottom: 1px solid var(--ink-12); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .app-nav-in { display: flex; align-items: center; gap: 12px; height: 64px; max-width: 1160px; margin: 0 auto; padding: 0 16px; }
        .app-brand { display: flex; align-items: baseline; gap: 8px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); white-space: nowrap; }
        .app-ko-mark { color: var(--ink-60); font-weight: 700; font-size: 16px; }
        .app-links { display: none; }
        .app-nav-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
        .app-toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .app-toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 12px; padding: 6px 10px; cursor: pointer; color: var(--ink-60); white-space: nowrap; }
        .app-toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .long { display: none; }
        .short { display: inline; }
        @media (min-width: 600px) {
          .app-nav-in { padding: 0 24px; }
          .long { display: inline; }
          .short { display: none; }
          .app-toggle button { font-size: 12.5px; padding: 6px 11px; }
        }
        @media (max-width: 420px) {
          .app-ko-mark { display: none; }
        }
        @media (max-width: 360px) {
          .app-nav-in { gap: 8px; padding: 0 10px; }
          .app-nav-right { gap: 4px; }
          .app-brand { font-size: 18px; }
          .app-toggle button { padding: 6px 8px; }
        }
        @media (min-width: 900px) {
          .app-nav-in { gap: 20px; }
          .app-links { display: flex; gap: 2px; margin-left: 12px; }
          .app-links a { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; border-radius: 999px; text-decoration: none; color: var(--ink-60); font-weight: 700; font-size: 14.5px; white-space: nowrap; transition: background 0.12s, color 0.12s; }
          .app-links a:hover { background: rgba(30, 34, 48, 0.06); color: var(--ink); }
          .app-links a.on { background: var(--ink); color: var(--paper); }
        }
      `}</style>
    </header>
    <PushPrompt lang={lang} />
    </>
  );
}
