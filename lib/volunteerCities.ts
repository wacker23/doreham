/**
 * Cities where Doreham offers volunteer (봉사) quests. Safe to import from client code.
 * lib/server/volunteer1365.ts holds the 1365 region codes for each of these slugs.
 */
export const VOLUNTEER_CITY_SLUGS = ['asan', 'cheonan'] as const;
export const VOLUNTEER_CITY_SET: ReadonlySet<string> = new Set(VOLUNTEER_CITY_SLUGS);
