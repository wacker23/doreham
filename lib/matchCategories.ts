/**
 * Category definitions for match preferences.
 * Maps user-facing category slugs to actual venue.category values.
 *
 * Used by:
 *   - app/matches/page.tsx (UI picker)
 *   - app/api/process-match-requests/route.ts (venue filter)
 */

export type MatchCategory = {
  slug: string;         // user-facing slug stored in match_requests.preferred_categories
  label_en: string;
  label_ko: string;
  icon: string;         // PNG filename in /public/categories/ (without extension)
  // Must be values of the public.venue_category enum:
  // cafe, restaurant, board_game_cafe, escape_room, bookshop, workshop_creative,
  // active_sports, cultural_venue, nature_outdoor, music_movie, other
  venue_categories: string[];
  coming_soon?: boolean;
  volunteer?: boolean;
};

export const MATCH_CATEGORIES: MatchCategory[] = [
  { slug: 'coffee', label_en: 'Coffee', label_ko: '카페', icon: 'coffee', venue_categories: ['cafe'] },
  { slug: 'food', label_en: 'Food', label_ko: '음식', icon: 'food', venue_categories: ['restaurant'] },
  { slug: 'books', label_en: 'Books', label_ko: '책', icon: 'books', venue_categories: ['bookshop'] },
  { slug: 'game', label_en: 'Games', label_ko: '게임', icon: 'game', venue_categories: ['board_game_cafe'] },
  { slug: 'movie', label_en: 'Movie', label_ko: '영화', icon: 'movie', venue_categories: ['music_movie', 'cultural_venue'] },
  { slug: 'nature', label_en: 'Nature', label_ko: '자연', icon: 'nature', venue_categories: ['nature_outdoor'] },
  { slug: 'adventure', label_en: 'Adventure', label_ko: '모험', icon: 'adventure', venue_categories: ['active_sports', 'nature_outdoor'] },
  { slug: 'nightout', label_en: 'Night Out', label_ko: '나이트아웃', icon: 'nightout', venue_categories: ['music_movie', 'other'] },
  { slug: 'puzzle', label_en: 'Puzzle', label_ko: '퍼즐', icon: 'puzzle', venue_categories: ['escape_room', 'board_game_cafe'] },
  { slug: 'makethings', label_en: 'Craft', label_ko: '공예', icon: 'makethings', venue_categories: ['workshop_creative'] },
  { slug: 'network', label_en: 'Network', label_ko: '네트워킹', icon: 'network', venue_categories: ['cultural_venue', 'cafe'] },
  // 'help' = volunteer quest (1365 봉사활동). Exclusive: it can't be combined with venue categories.
  { slug: 'help', label_en: 'Volunteer', label_ko: '봉사', icon: 'help', venue_categories: [], volunteer: true },
];

/**
 * Given user-selected category slugs, returns the venue.category values to filter against.
 * Empty input = null return (any category).
 */
export function expandCategoriesToVenueCategories(slugs: string[] | null | undefined): string[] | null {
  if (!slugs || slugs.length === 0) return null;
  const set = new Set<string>();
  for (const slug of slugs) {
    const cat = MATCH_CATEGORIES.find((c) => c.slug === slug);
    if (cat) cat.venue_categories.forEach((vc) => set.add(vc));
  }
  return set.size > 0 ? Array.from(set) : null;
}