'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { appTabs, isTabActive } from '@/lib/appTabs';
import { isVenueAccount } from '@/lib/accountType';

/**
 * Bottom tab bar for phones and tablets (Matches · Events · Ranking · Me).
 * On computers (900px and wider) the same links sit in the header instead (AppHeader).
 */
export function AppTabBar({ lang }: { lang: 'en' | 'ko' }) {
  const pathname = usePathname() ?? '';
  const { user, profile } = useUser();
  if (!user) return null;

  return (
    <nav className="app-tabs" aria-label={lang === 'ko' ? '메뉴' : 'Main'}>
      <div className="app-tabs-in">
        {appTabs(user.id, isVenueAccount(profile)).map((t) => {
          const active = isTabActive(pathname, t);
          return (
            <a key={t.href} href={t.href} className={`app-tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
              <span className="app-tab-icon" aria-hidden="true">{t.icon}</span>
              <span className="app-tab-label">{lang === 'ko' ? t.ko : t.en}</span>
            </a>
          );
        })}
      </div>
      <style jsx>{`
        .app-tabs { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; background: rgba(255, 255, 255, 0.96); border-top: 1px solid var(--ink-12); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); padding: 6px 8px calc(6px + env(safe-area-inset-bottom)); }
        .app-tabs-in { display: flex; justify-content: space-around; max-width: 560px; margin: 0 auto; }
        .app-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; text-decoration: none; color: var(--ink-60); font-size: 11.5px; font-weight: 600; border-radius: 12px; }
        .app-tab.active { color: var(--ink); }
        .app-tab.active .app-tab-icon { transform: scale(1.12); }
        .app-tab-icon { font-size: 21px; line-height: 1.1; transition: transform 0.15s; }
        @media (min-width: 900px) {
          .app-tabs { display: none; }
        }
      `}</style>
      <style jsx global>{`
        @media (max-width: 899px) {
          body:has(.app-tabs) { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
        }
      `}</style>
    </nav>
  );
}
