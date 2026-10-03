/**
 * Points, levels, badges and level unlocks. Client-safe (no server imports).
 * The awarding rules themselves live in SQL (public.sync_points); keep POINT_RULES in sync with it.
 * Pictures: levels and badges are drawn in components/icons/SeaArt.tsx (levelArt(n), badge id).
 */
import type { IconName } from '@/components/icons/Icon';

export type Level = {
  n: number;
  min: number;
  en: string;
  ko: string;
};

/** Sea-themed levels, after Doro and Hami the jellyfish. By all-time points. */
export const LEVELS: Level[] = [
  { n: 1, min: 0, en: 'Bubble', ko: '물방울' },
  { n: 2, min: 100, en: 'Shell', ko: '조개' },
  { n: 3, min: 300, en: 'Fish', ko: '물고기' },
  { n: 4, min: 700, en: 'Jellyfish', ko: '해파리' },
  { n: 5, min: 1500, en: 'Dolphin', ko: '돌고래' },
  { n: 6, min: 3000, en: 'Whale', ko: '고래' },
];

export function levelFor(total: number): Level {
  let l = LEVELS[0];
  for (const x of LEVELS) if (total >= x.min) l = x;
  return l;
}

export function levelByNumber(n: number): Level {
  return LEVELS.find((l) => l.n === n) ?? LEVELS[0];
}

/** Progress toward the next level: 0..1, and points still needed (null at the top). */
export function levelProgress(total: number) {
  const cur = levelFor(total);
  const next = LEVELS.find((l) => l.n === cur.n + 1) ?? null;
  if (!next) return { level: cur, next: null, progress: 1, needed: null as number | null };
  const progress = Math.max(0, Math.min(1, (total - cur.min) / (next.min - cur.min)));
  return { level: cur, next, progress, needed: next.min - Math.max(total, 0) };
}

export function levelName(l: Level, lang: 'en' | 'ko') {
  return lang === 'ko' ? l.ko : l.en;
}

export type PointReason =
  | 'welcome'
  | 'quest'
  | 'volunteer'
  | 'volunteer_certificate'
  | 'reviews_given'
  | 'compliment'
  | 'event_host'
  | 'strike'
  | 'admin_adjust';

/** How to earn (shown on the points page). Same numbers as public.sync_points(). */
export const POINT_RULES: { reason: PointReason; points: number; icon: IconName; en: string; ko: string; short_en: string; short_ko: string }[] = [
  { reason: 'quest', points: 50, icon: 'matches', en: 'Show up to a quest (QR check-in)', ko: '퀘스트 참여 (QR 체크인)', short_en: 'Quest', short_ko: '퀘스트 참여' },
  { reason: 'volunteer', points: 80, icon: 'volunteer', en: 'Finish a volunteer (봉사) quest (in the group selfie)', ko: '봉사 퀘스트 완료 (단체 사진에 포함)', short_en: 'Volunteer quest', short_ko: '봉사 퀘스트' },
  { reason: 'volunteer_certificate', points: 20, icon: 'doc', en: 'Upload your 1365 certificate (optional)', ko: '1365 확인서 올리기 (선택)', short_en: '1365 certificate', short_ko: '1365 확인서' },
  { reason: 'reviews_given', points: 10, icon: 'edit', en: 'Review your group after a quest', ko: '퀘스트 후 그룹 리뷰 남기기', short_en: 'Reviewed your group', short_ko: '그룹 리뷰' },
  { reason: 'compliment', points: 5, icon: 'heart', en: 'Get a compliment in a review', ko: '리뷰에서 칭찬 받기', short_en: 'Compliment received', short_ko: '칭찬 받음' },
  { reason: 'event_host', points: 30, icon: 'host', en: 'Host an event with 3+ people going (2 a month)', ko: '3명 이상 참여한 이벤트 주최 (한 달 2회까지)', short_en: 'Hosted an event', short_ko: '이벤트 주최' },
  { reason: 'welcome', points: 20, icon: 'hello', en: 'Complete your profile', ko: '프로필 완성', short_en: 'Profile completed', short_ko: '프로필 완성' },
  { reason: 'strike', points: -30, icon: 'warning', en: 'Strike (no-show or leaving a confirmed group)', ko: '경고 (불참 또는 확정된 그룹에서 나가기)', short_en: 'Strike', short_ko: '경고' },
];

/** Short label for a history row. */
export function reasonLabel(reason: string, lang: 'en' | 'ko') {
  const r = POINT_RULES.find((x) => x.reason === reason);
  if (r) return lang === 'ko' ? r.short_ko : r.short_en;
  return reason === 'admin_adjust' ? (lang === 'ko' ? '관리자 조정' : 'Adjusted by Doreham') : reason;
}

/** Icon for a history row. */
export function reasonIcon(reason: string): IconName {
  return POINT_RULES.find((x) => x.reason === reason)?.icon ?? 'admin';
}

/** What each level unlocks inside the app (venue perks come on top of these). */
export const LEVEL_UNLOCKS: { level: number; icon: IconName; en: string; ko: string }[] = [
  { level: 2, icon: 'tag', en: 'Your level shows on your profile and events', ko: '프로필과 이벤트에 내 레벨 표시' },
  { level: 3, icon: 'events', en: 'Host up to 5 events at once (instead of 3)', ko: '이벤트를 동시에 5개까지 열기 (기본 3개)' },
  { level: 4, icon: 'priority', en: 'Priority matching: your requests are matched first', ko: '우선 매칭: 내 매칭 요청을 먼저 처리' },
  { level: 5, icon: 'announce', en: 'Host up to 8 events at once', ko: '이벤트를 동시에 8개까지 열기' },
];

/** Open personal events someone can host at once, by level. */
export function hostLimitForLevel(level: number) {
  return level >= 5 ? 8 : level >= 3 ? 5 : 3;
}

export const PRIORITY_MATCHING_LEVEL = 4;

export type BadgeId =
  | 'founding'
  | 'first_quest'
  | 'regular'
  | 'adventurer'
  | 'helper'
  | 'hero'
  | 'host'
  | 'builder'
  | 'warm'
  | 'reliable'
  | 'top10';

export const BADGES: { id: BadgeId; en: string; ko: string; how_en: string; how_ko: string }[] = [
  { id: 'first_quest', en: 'First adventure', ko: '첫 모험', how_en: 'Finish your first quest', how_ko: '첫 퀘스트 완료' },
  { id: 'regular', en: 'Regular', ko: '단골', how_en: 'Finish 5 quests', how_ko: '퀘스트 5회 완료' },
  { id: 'adventurer', en: 'Adventurer', ko: '모험가', how_en: 'Finish 20 quests', how_ko: '퀘스트 20회 완료' },
  { id: 'helper', en: 'Helping hand', ko: '도움의 손길', how_en: 'Finish a volunteer quest', how_ko: '봉사 퀘스트 1회 완료' },
  { id: 'hero', en: 'Community hero', ko: '동네 영웅', how_en: 'Finish 5 volunteer quests', how_ko: '봉사 퀘스트 5회 완료' },
  { id: 'host', en: 'Host', ko: '호스트', how_en: 'Host an event with 3+ people going', how_ko: '3명 이상 참여한 이벤트 주최' },
  { id: 'builder', en: 'Community builder', ko: '커뮤니티 빌더', how_en: 'Host 5 events with 3+ people going', how_ko: '3명 이상 참여한 이벤트 5회 주최' },
  { id: 'warm', en: 'Warm heart', ko: '따뜻한 마음', how_en: 'Get 10 compliments in reviews', how_ko: '리뷰 칭찬 10회 받기' },
  { id: 'reliable', en: 'Reliable', ko: '믿음직', how_en: '5+ quests and no strikes in the last 90 days', how_ko: '퀘스트 5회 이상, 최근 90일 경고 없음' },
  { id: 'top10', en: 'Top 10', ko: '톱 10', how_en: 'Finish a month in the national top 10', how_ko: '월간 전국 순위 10위 안에 들기' },
  { id: 'founding', en: 'Founding member', ko: '창립 멤버', how_en: 'Joined Doreham in 2026', how_ko: '2026년에 도레함 가입' },
];

export function badge(id: string) {
  return BADGES.find((b) => b.id === id);
}

/** "2026-10" for the current Korean month, and when it started (UTC ISO). */
export function kstMonth(date = new Date()) {
  const k = new Date(date.getTime() + 9 * 3_600_000);
  const y = k.getUTCFullYear();
  const m = k.getUTCMonth();
  const period = `${y}-${String(m + 1).padStart(2, '0')}`;
  const startIso = new Date(Date.UTC(y, m, 1) - 9 * 3_600_000).toISOString();
  return { period, startIso };
}

export function previousKstMonth(date = new Date()) {
  const { startIso } = kstMonth(date);
  return kstMonth(new Date(new Date(startIso).getTime() - 1000));
}
