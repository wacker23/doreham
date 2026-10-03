/**
 * Which icon goes with which piece of data. Client-safe, no JSX.
 * Drawings: components/icons/Icon.tsx (everyday), SeaArt.tsx (levels/badges) and
 * categoryArt.tsx (Sophia's category set as vectors). The original category PNGs in
 * public/categories are still used for big illustrations (landing, event card placeholders).
 */
import type { IconName } from '@/components/icons/Icon';

/** Category artwork (vector: categoryArt.tsx; PNG: public/categories). */
export type CategoryArt =
  | 'adventure'
  | 'books'
  | 'chat'
  | 'coffee'
  | 'food'
  | 'game'
  | 'help'
  | 'makethings'
  | 'movie'
  | 'nature'
  | 'network'
  | 'nightout'
  | 'puzzle'
  | 'venue'
  | 'other';

export function categoryArtSrc(art: CategoryArt) {
  return art === 'other' ? '/categories/other.svg' : `/categories/${art}.png`;
}

/** Venue category (venues.category) → artwork. */
export const VENUE_CATEGORY_ART: Record<string, CategoryArt> = {
  cafe: 'coffee',
  restaurant: 'food',
  board_game_cafe: 'game',
  escape_room: 'puzzle',
  bookshop: 'books',
  workshop_creative: 'makethings',
  active_sports: 'adventure',
  cultural_venue: 'makethings',
  nature_outdoor: 'nature',
  music_movie: 'movie',
  bar_club: 'nightout',
  other: 'venue',
};

export function venueCategoryArt(category: string | null | undefined): CategoryArt {
  return (category && VENUE_CATEGORY_ART[category]) || 'venue';
}

/** Interests / activity preferences (profiles.activity_preferences) → artwork. */
export const ACTIVITY_ART: Record<string, CategoryArt> = {
  conversation_coffee: 'coffee',
  board_games_casual: 'game',
  workshops_creative: 'makethings',
  active_outdoor: 'adventure',
  food_dining: 'food',
  learning_culture: 'books',
  nature_calm: 'nature',
  escape_puzzles: 'puzzle',
  movies_music_shows: 'movie',
  career_networking: 'network',
  volunteering_community: 'help',
  nightlife_social: 'nightout',
};

/** Notification type → icon (the bell list and the notifications page). */
export const NOTIFICATION_ICON: Record<string, IconName> = {
  match_invite: 'matchFound',
  match_activated: 'matches',
  match_cancelled: 'sad',
  match_found: 'matchFound',
  no_match_found: 'search',
  member_left: 'hello',
  quest_scheduled: 'date',
  availability_reminder: 'vote',
  check_in_reminder: 'location',
  quest_day_reminder: 'date',
  review_reminder: 'star',
  strike_issued: 'warning',
  welcome: 'hello',
  event_joined: 'join',
  event_comment: 'chat',
  event_updated: 'date',
  event_cancelled: 'cancelled',
  event_reminder: 'reminder',
  level_up: 'levelUp',
  monthly_rank: 'ranking',
  plus_granted: 'plus',
  chat_message: 'chat',
};

/** Soft background behind a notification icon, by type. */
export const NOTIFICATION_TINT: Record<string, string> = {
  match_invite: '#FCE3E5',
  match_found: '#FCE3E5',
  match_activated: '#FCE3E5',
  strike_issued: '#FFF1D6',
  match_cancelled: '#F1F0EE',
  event_cancelled: '#F1F0EE',
  level_up: '#E1F0F4',
  monthly_rank: '#FFE9DE',
  plus_granted: '#FDE9E1',
};

/** City slug → icon. */
export const CITY_ICON: Record<string, IconName> = {
  seoul: 'seoul',
  busan: 'busan',
  incheon: 'incheon',
  daegu: 'daegu',
  daejeon: 'daejeon',
  gwangju: 'gwangju',
  suwon: 'suwon',
  asan: 'asan',
  cheonan: 'cheonan',
  ulsan: 'ulsan',
  jeonju: 'jeonju',
  jeju: 'jeju',
};

/**
 * Text saved before the icons (notification titles, quest titles) can start or end with an
 * emoji. Strip it so the icon next to it isn't doubled. Inner text is left alone.
 */
const EDGE_EMOJI =
  /^(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{2190}-\u{21FF}][\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}]*)+\s*|\s*(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}][\u{FE0F}\u{200D}]*)+$/gu;
export function stripEmoji(text: string | null | undefined): string {
  return (text ?? '').replace(EDGE_EMOJI, '').trim();
}

/** Lifestyle answers (sign-up, profile, edit modal) → icon. Missing → no icon. */
export const LIFESTYLE_ICON: Record<string, Record<string, IconName>> = {
  exercise_frequency: { never: 'exNever', occasionally: 'exSometimes', weekly_1_2: 'exWeekly', weekly_3_4: 'exOften', daily: 'exDaily' },
  education_level: { high_school: 'school', college_student: 'college', bachelors: 'bachelor', masters: 'master', doctoral: 'doctor', other: 'sparkle' },
  drinking_habits: { no: 'noDrink', occasionally: 'wine', socially: 'cheers', regularly: 'beer', prefer_not_to_say: 'noAnswer' },
  smoking_habits: { non_smoker: 'noSmoke', occasionally: 'smoke', regular: 'smoke', former: 'exSmoker', vape: 'vape', prefer_not_to_say: 'noAnswer' },
  children_status: { no_children: 'noKids', have_children: 'kids', expecting: 'expecting', prefer_not_to_say: 'noAnswer' },
  gender: { female: 'female', male: 'male', non_binary: 'nonbinary', prefer_not_to_say: 'noAnswer' },
};

export function lifestyleIcon(field: string, code: string | null | undefined): IconName | null {
  return (code && LIFESTYLE_ICON[field]?.[code]) || null;
}

/** Review tags (member and venue review tag ids) → icon. The tables' emoji column is no longer shown. */
export const REVIEW_TAG_ICON: Record<string, IconName> = {
  considerate: 'heart',
  followed_thru: 'done',
  kind_courteous: 'volunteer',
  meet_again: 'star',
  punctual: 'time',
  quick_replies: 'chat',
  thorough: 'college',
  welcoming: 'hello',
  adventurous: 'explore',
  calming: 'observer',
  creative: 'gwangju',
  cultural: 'online',
  down_for_any: 'events',
  foodie: 'bowl',
  fun_energy: 'energizer',
  good_taste: 'music',
  great_listener: 'goal',
  high_energy: 'priority',
  interesting: 'tip',
  kind_eyes: 'me',
  photo_buddy: 'camera',
  positive: 'warmth',
  storyteller: 'host',
  // review_concern_tags (private)
  cancelled: 'cancelled',
  different: 'warning',
  inconsiderate: 'sad',
  late: 'time',
  uncomfortable: 'sad',
  unresponsive: 'chat',
  // venue_compliment_tags / venue_concern_tags
  atmosphere: 'sparkle',
  clean: 'done',
  delicious: 'bowl',
  easy_find: 'location',
  friendly_staff: 'hello',
  good_groups: 'people',
  value: 'price',
  wifi_outlets: 'online',
  not_described: 'cancelled',
  not_groups: 'people',
  overpriced: 'price',
  too_loud: 'announce',
  unwelcoming: 'sad',
};

export function reviewTagIcon(id: string): IconName {
  return REVIEW_TAG_ICON[id] ?? 'sparkle';
}
