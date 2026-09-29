/**
 * City rules shared by the request form (client) and matching (server).
 */

/** Cities anyone can pick for any quest, even before venues there are approved. */
export const LAUNCH_CITY_SLUGS = ['asan', 'cheonan', 'seoul'] as const;
export const LAUNCH_CITY_SET: ReadonlySet<string> = new Set(LAUNCH_CITY_SLUGS);

/** Cities with volunteer (봉사) quests. lib/server/volunteer1365.ts holds their 1365 region codes. */
export const VOLUNTEER_CITY_SLUGS = ['asan', 'cheonan', 'seoul'] as const;
export const VOLUNTEER_CITY_SET: ReadonlySet<string> = new Set(VOLUNTEER_CITY_SLUGS);

/** How many cities one request may list. */
export const MAX_REQUEST_CITIES = 3;

/**
 * Cities close enough that people living in one can be invited to a quest in the other
 * (from matching pass 2 on). Asan ↔ Cheonan is about 20 minutes by subway or bus.
 */
export const NEARBY_CITIES: Readonly<Record<string, readonly string[]>> = {
  asan: ['cheonan'],
  cheonan: ['asan'],
};

export type KoreanCity = {
  slug: string;
  name_en: string;
  name_ko: string;
  emoji: string;
};

/** Cities shown in pickers, in display order (Sophia's order, Sep 29). */
export const KOREAN_CITIES: KoreanCity[] = [
  { slug: 'seoul', name_en: 'Seoul', name_ko: '서울', emoji: '🏙️' },
  { slug: 'busan', name_en: 'Busan', name_ko: '부산', emoji: '🌊' },
  { slug: 'incheon', name_en: 'Incheon', name_ko: '인천', emoji: '✈️' },
  { slug: 'daegu', name_en: 'Daegu', name_ko: '대구', emoji: '⛰️' },
  { slug: 'daejeon', name_en: 'Daejeon', name_ko: '대전', emoji: '🔬' },
  { slug: 'gwangju', name_en: 'Gwangju', name_ko: '광주', emoji: '🎨' },
  { slug: 'suwon', name_en: 'Suwon', name_ko: '수원', emoji: '🏯' },
  { slug: 'asan', name_en: 'Asan', name_ko: '아산', emoji: '🍃' },
  { slug: 'cheonan', name_en: 'Cheonan', name_ko: '천안', emoji: '🌸' },
  { slug: 'ulsan', name_en: 'Ulsan', name_ko: '울산', emoji: '🏭' },
  { slug: 'jeonju', name_en: 'Jeonju', name_ko: '전주', emoji: '🍚' },
  { slug: 'jeju', name_en: 'Jeju', name_ko: '제주', emoji: '🌴' },
];

export function cityName(slug: string | null | undefined, lang: 'en' | 'ko'): string {
  if (!slug) return lang === 'ko' ? '어디든' : 'Anywhere';
  const c = KOREAN_CITIES.find((x) => x.slug === slug);
  return c ? (lang === 'ko' ? c.name_ko : c.name_en) : slug;
}
