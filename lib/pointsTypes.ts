/** Shapes returned by /api/points/* and /api/perks*. Client-safe. */

export type LeaderboardEntry = {
  rank: number;
  points: number;
  is_me: boolean;
  user: { id: string; display_name: string; photo_url: string | null; city: string | null; level: number };
};

export type LeaderboardResponse = {
  period: 'month' | 'all';
  month: string;
  entries: LeaderboardEntry[];
  me: { rank: number; points: number } | null;
  hidden: boolean;
};

export type MySummary = {
  total: number;
  month: string;
  month_points: number;
  month_rank: number | null;
  level: number;
  next_level: number | null;
  progress: number;
  needed: number | null;
  hidden: boolean;
  stats: { quests: number; volunteer: number; hosted: number; compliments: number };
  badges: { id: string; earned: boolean }[];
  history: { reason: string; delta: number; created_at: string }[];
};

export type ProfilePoints = {
  total: number;
  level: number;
  stats: { quests: number; volunteer: number; hosted: number; compliments: number };
  badges: string[];
};

export type Perk = {
  id: string;
  title: string;
  details: string | null;
  min_level: number;
  source_lang: string | null;
  translated_to: string | null;
  title_tr: string | null;
  details_tr: string | null;
  unlocked: boolean;
  used_today: boolean;
  venue: { id: string; name: string; city: string; category: string; address: string | null; photo_url: string | null };
};

export type Redemption = {
  already_used_today: boolean;
  redeemed_at: string;
  /** null when the perk was already used today and can't be shown again. */
  code: string | null;
  perk: Pick<Perk, 'id' | 'title' | 'details' | 'title_tr' | 'details_tr' | 'source_lang' | 'translated_to' | 'min_level'>;
  venue: { id: string; name: string };
  member: { display_name: string; photo_url: string | null; level: number };
};

/** Perk text in the viewer's language when we have a translation. */
export function perkText(p: Pick<Perk, 'title' | 'details' | 'title_tr' | 'details_tr' | 'source_lang' | 'translated_to'>, lang: 'en' | 'ko') {
  const tr = p.translated_to === lang && p.source_lang !== lang && !!p.title_tr;
  return { title: tr ? p.title_tr! : p.title, details: tr ? p.details_tr || p.details : p.details, translated: tr };
}

export const PERK_ERRORS: Record<string, { en: string; ko: string }> = {
  level_too_low: { en: 'Your level is too low for this perk yet.', ko: '아직 이 혜택을 쓸 수 있는 레벨이 아니에요.' },
  finish_onboarding: { en: 'Finish your profile first.', ko: '먼저 프로필을 완성해 주세요.' },
  not_found: { en: 'This perk is no longer available.', ko: '더 이상 제공되지 않는 혜택이에요.' },
  title_too_short: { en: 'Describe the perk in a few words (at least 3 characters).', ko: '혜택 내용을 3자 이상 입력해 주세요.' },
  bad_level: { en: 'Pick a level.', ko: '레벨을 선택해 주세요.' },
  too_many_perks: { en: 'A venue can have up to 5 perks.', ko: '가게당 혜택은 5개까지 만들 수 있어요.' },
  venue_not_approved: { en: 'Perks can be added once your venue is approved.', ko: '가게가 승인된 뒤에 혜택을 추가할 수 있어요.' },
  not_allowed: { en: "You can't change this venue.", ko: '이 가게를 수정할 권한이 없어요.' },
};

export function perkError(code: string, lang: 'en' | 'ko') {
  const m = PERK_ERRORS[code];
  return m ? m[lang] : lang === 'ko' ? '문제가 생겼어요. 다시 시도해 주세요.' : 'Something went wrong. Please try again.';
}
