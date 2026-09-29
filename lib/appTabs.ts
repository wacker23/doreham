/** The signed-in app's main sections: bottom tab bar on phones and tablets, header links on computers. */
export type AppTab = { href: string; match: string; icon: string; en: string; ko: string };

export function appTabs(userId: string): AppTab[] {
  return [
    { href: '/matches', match: '/matches', icon: '🌸', en: 'Matches', ko: '매칭' },
    { href: '/events', match: '/events', icon: '🎉', en: 'Events', ko: '이벤트' },
    { href: '/leaderboard', match: '/leaderboard', icon: '🏆', en: 'Ranking', ko: '랭킹' },
    { href: `/profile/${userId}`, match: `/profile/${userId}`, icon: '👤', en: 'Me', ko: '나' },
  ];
}

export function isTabActive(pathname: string, tab: AppTab) {
  return pathname === tab.match || pathname.startsWith(`${tab.match}/`);
}

/** Width at which the bottom tab bar turns into header links. Keep in sync with the CSS below it. */
export const DESKTOP_MIN_WIDTH = 900;
