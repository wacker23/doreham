'use client';

import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';

/**
 * Bottom tab bar for the signed-in app (Matches · Events · Ranking · Me).
 * While it is on the page, the body gets bottom padding so nothing hides behind it.
 */
export function AppTabBar({ lang }: { lang: 'en' | 'ko' }) {
  const pathname = usePathname() ?? '';
  const { user } = useUser();
  if (!user) return null;

  const tabs = [
    { href: '/matches', match: '/matches', icon: '🌸', en: 'Matches', ko: '매칭' },
    { href: '/events', match: '/events', icon: '🎉', en: 'Events', ko: '이벤트' },
    { href: '/leaderboard', match: '/leaderboard', icon: '🏆', en: 'Ranking', ko: '랭킹' },
    { href: `/profile/${user.id}`, match: `/profile/${user.id}`, icon: '👤', en: 'Me', ko: '나' },
  ];

  return (
    <nav className="app-tabs" aria-label={lang === 'ko' ? '메뉴' : 'Main'}>
      {tabs.map((t) => {
        const active = pathname.startsWith(t.match);
        return (
          <a key={t.href} href={t.href} className={`app-tab ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="app-tab-icon" aria-hidden="true">{t.icon}</span>
            <span className="app-tab-label">{lang === 'ko' ? t.ko : t.en}</span>
          </a>
        );
      })}
      <style jsx>{`
        .app-tabs { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; display: flex; justify-content: center; background: rgba(255, 255, 255, 0.96); border-top: 1px solid var(--ink-12); backdrop-filter: blur(8px); padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); }
        .app-tab { flex: 1; max-width: 120px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 0; text-decoration: none; color: var(--ink-60); font-size: 11.5px; font-weight: 600; border-radius: 12px; }
        .app-tab.active { color: var(--ink); }
        .app-tab.active .app-tab-icon { transform: scale(1.12); }
        .app-tab-icon { font-size: 21px; line-height: 1.1; transition: transform 0.15s; }
      `}</style>
      <style jsx global>{`
        body:has(.app-tabs) { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
      `}</style>
    </nav>
  );
}
