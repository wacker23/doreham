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
