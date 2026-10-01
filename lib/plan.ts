/**
 * Doreham+ (the one paid plan). Client-safe: constants, labels and the comparison table.
 * Enforcement lives in the database (match requests, venue registration) and in
 * lib/server/events.ts (hosting). Until payments exist, Doreham+ is given by Doreham.
 */

export const PLUS_NAME = 'Doreham+';
export const FREE_MATCH_REQUESTS_PER_MONTH = 2;
export const PLUS_EXTRA_OPEN_EVENTS = 2;
export const PLUS_PRICE_MONTH_WON = 4900;
export const PLUS_PRICE_YEAR_WON = 39000;

export type PlanStatus = {
  /** A real Doreham+ membership. */
  plus: boolean;
  expires_at: string | null;
  match_requests_used: number;
  match_requests_limit: number;
  /** false = test period: plan limits are switched off and everyone can use everything. */
  enforced: boolean;
};

/** Whether Doreham+ features are open to this person right now (member, or plans not enforced yet). */
export function planUnlocked(p: Pick<PlanStatus, 'plus' | 'enforced'> | null | undefined): boolean {
  return !!p && (p.plus || p.enforced === false);
}

export type PlanHistoryEntry = {
  id: string;
  action: 'granted' | 'extended' | 'removed' | 'purchased' | 'renewed' | 'cancelled' | 'refunded';
  source: 'doreham' | 'payment';
  months: number | null;
  amount_won: number | null;
  ends_at: string | null;
  created_at: string;
};

export type Membership = PlanStatus & {
  member_since: string | null;
  events_open: number;
  events_limit: number;
  history: PlanHistoryEntry[];
};

export function historyLabel(h: PlanHistoryEntry, lang: 'en' | 'ko'): string {
  const ko = lang === 'ko';
  const m = h.months;
  const period = m == null ? (ko ? '기간 제한 없음' : 'no end date') : ko ? `${m}개월` : `${m} month${m === 1 ? '' : 's'}`;
  switch (h.action) {
    case 'granted':
      return ko ? `Doreham+ 시작 · ${period} · 도레함 제공` : `Doreham+ started · ${period} · given by Doreham`;
    case 'extended':
      return ko ? `Doreham+ 연장 · ${period} · 도레함 제공` : `Doreham+ extended · ${period} · given by Doreham`;
    case 'removed':
      return ko ? 'Doreham+ 종료' : 'Doreham+ ended';
    case 'purchased':
      return ko ? `Doreham+ 결제 · ${period}` : `Doreham+ bought · ${period}`;
    case 'renewed':
      return ko ? `Doreham+ 자동 갱신 · ${period}` : `Doreham+ renewed · ${period}`;
    case 'cancelled':
      return ko ? 'Doreham+ 해지' : 'Doreham+ cancelled';
    case 'refunded':
      return ko ? '환불' : 'Refunded';
  }
}

/** For showing a badge from a profile row (the server/DB decides access). */
export function isPlusActive(tier: string | null | undefined, expiresAt: string | null | undefined, now = Date.now()) {
  return tier === 'plus' && (!expiresAt || new Date(expiresAt).getTime() > now);
}

export function wonLabel(n: number) {
  return `₩${n.toLocaleString('en-US')}`;
}

type Cell = { en: string; ko: string } | true | false;
export type PlanRow = { en: string; ko: string; free: Cell; plus: Cell };

export const PLAN_ROWS: PlanRow[] = [
  {
    en: 'Match requests',
    ko: '매칭 요청',
    free: { en: `${FREE_MATCH_REQUESTS_PER_MONTH} per month`, ko: `한 달에 ${FREE_MATCH_REQUESTS_PER_MONTH}번` },
    plus: { en: 'Unlimited', ko: '무제한' },
  },
  { en: 'Being matched into groups', ko: '그룹에 매칭되기', free: true, plus: true },
  { en: '봉사 volunteer quests', ko: '봉사 퀘스트', free: true, plus: true },
  { en: 'See and join events', ko: '이벤트 보기·참여', free: true, plus: true },
  {
    en: 'Host events',
    ko: '이벤트 열기',
    free: { en: 'Your level limit', ko: '레벨 한도만큼' },
    plus: { en: `+${PLUS_EXTRA_OPEN_EVENTS} extra open events`, ko: `동시에 ${PLUS_EXTRA_OPEN_EVENTS}개 더` },
  },
  { en: 'Chat, notifications, safety tools', ko: '채팅, 알림, 안전 기능', free: true, plus: true },
  { en: 'Pick the group size', ko: '그룹 인원 고르기', free: false, plus: true },
  { en: 'Choose categories', ko: '카테고리 고르기', free: false, plus: true },
  { en: 'Register your venue', ko: '가게 등록', free: false, plus: true },
  { en: 'Doreham+ badge on your profile', ko: '프로필에 Doreham+ 배지', free: false, plus: true },
];

/** Readable messages for the plan errors the database raises. */
export const PLAN_ERRORS: Record<string, { en: string; ko: string }> = {
  monthly_limit: {
    en: `You've used your ${FREE_MATCH_REQUESTS_PER_MONTH} free match requests this month. 봉사 volunteer quests are still open, or get Doreham+ for unlimited requests.`,
    ko: `이번 달 무료 매칭 요청 ${FREE_MATCH_REQUESTS_PER_MONTH}번을 모두 사용했어요. 봉사 퀘스트는 계속 신청할 수 있고, Doreham+로 무제한 요청할 수 있어요.`,
  },
  plus_required: {
    en: 'Registering a venue is part of Doreham+.',
    ko: '가게 등록은 Doreham+ 기능이에요.',
  },
};

export function planError(message: string | null | undefined, lang: 'en' | 'ko'): string | null {
  if (!message) return null;
  const key = Object.keys(PLAN_ERRORS).find((k) => message.includes(k));
  return key ? PLAN_ERRORS[key][lang] : null;
}
