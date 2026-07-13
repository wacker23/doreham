// Shared types for venue registration flow
// Matches the actual venues table schema in Supabase

export type VenueCategory =
  | 'cafe'
  | 'restaurant'
  | 'board_game_cafe'
  | 'escape_room'
  | 'bookshop'
  | 'workshop_creative'
  | 'active_sports'
  | 'cultural_venue'
  | 'nature_outdoor'
  | 'music_movie'
  | 'other';

export type UiLanguage = 'en' | 'ko';

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type DayHours = {
  closed: boolean;
  open?: string;
  close?: string;
};

export type WeekHours = Record<Weekday, DayHours>;

export type MenuItem = {
  name: string;
  name_en?: string;
  description?: string;
  price_won?: number;
  is_signature: boolean;
  photo_url?: string;
  photo_file?: File;
};

export type VenueFormData = {
  // Step 1: Basic info
  business_name_display?: string;
  business_name_legal?: string;
  business_registration_number?: string;
  category?: VenueCategory;
  business_opened_at?: string;
  // Contact info (new)
  contact_email?: string;
  contact_phone?: string;
  contact_name?: string;

  // Step 2: Location
  address?: string;
  city?: string;
  district?: string;

  // Step 3: Hours
  hours?: WeekHours;

  // Step 4: Description + contact
  description?: string;
  description_en?: string;
  per_person_cost_won?: number;
  discount_offer?: string;
  discount_offer_en?: string;

  // Step 5: Photos
  photo_files?: File[];
  photo_urls?: string[];

  // Step 6: Menu items (only for cafe/restaurant)
  menu_items?: MenuItem[];
};

export type VenueStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const TOTAL_VENUE_STEPS = 7;

export const CATEGORY_LABELS: Record<VenueCategory, { en: string; ko: string; emoji: string; needsMenu: boolean }> = {
  cafe:              { en: 'Café / Coffee shop',       ko: '카페 / 커피숍',       emoji: '☕', needsMenu: true },
  restaurant:        { en: 'Restaurant',                ko: '식당',                emoji: '🍜', needsMenu: true },
  board_game_cafe:   { en: 'Board game café',           ko: '보드게임 카페',       emoji: '🎲', needsMenu: false },
  escape_room:       { en: 'Escape room',               ko: '방탈출',              emoji: '🧩', needsMenu: false },
  bookshop:          { en: 'Bookshop',                  ko: '서점',                emoji: '📚', needsMenu: false },
  workshop_creative: { en: 'Workshop / Creative class', ko: '원데이 클래스 / 공방',emoji: '🏺', needsMenu: false },
  active_sports:     { en: 'Sports / Active',           ko: '스포츠 · 액티비티',   emoji: '🥾', needsMenu: false },
  cultural_venue:    { en: 'Cultural venue',            ko: '문화 공간',           emoji: '🎨', needsMenu: false },
  nature_outdoor:    { en: 'Nature / Outdoor',          ko: '자연 · 야외',         emoji: '🌿', needsMenu: false },
  music_movie:       { en: 'Music / Movie',             ko: '음악 · 영화',         emoji: '🎬', needsMenu: false },
  other:             { en: 'Other',                     ko: '기타',                emoji: '🏪', needsMenu: false },
};

export const DEFAULT_HOURS: WeekHours = {
  mon: { closed: false, open: '09:00', close: '22:00' },
  tue: { closed: false, open: '09:00', close: '22:00' },
  wed: { closed: false, open: '09:00', close: '22:00' },
  thu: { closed: false, open: '09:00', close: '22:00' },
  fri: { closed: false, open: '09:00', close: '22:00' },
  sat: { closed: false, open: '10:00', close: '22:00' },
  sun: { closed: true },
};

export const WEEKDAY_LABELS: Record<Weekday, { en: string; ko: string }> = {
  mon: { en: 'Monday', ko: '월요일' },
  tue: { en: 'Tuesday', ko: '화요일' },
  wed: { en: 'Wednesday', ko: '수요일' },
  thu: { en: 'Thursday', ko: '목요일' },
  fri: { en: 'Friday', ko: '금요일' },
  sat: { en: 'Saturday', ko: '토요일' },
  sun: { en: 'Sunday', ko: '일요일' },
};

export const KOREAN_CITIES: { code: string; en: string; ko: string }[] = [
  { code: 'asan', en: 'Asan', ko: '아산' },
  { code: 'cheonan', en: 'Cheonan', ko: '천안' },
  { code: 'seoul', en: 'Seoul', ko: '서울' },
  { code: 'busan', en: 'Busan', ko: '부산' },
  { code: 'incheon', en: 'Incheon', ko: '인천' },
  { code: 'daegu', en: 'Daegu', ko: '대구' },
  { code: 'daejeon', en: 'Daejeon', ko: '대전' },
  { code: 'gwangju', en: 'Gwangju', ko: '광주' },
  { code: 'suwon', en: 'Suwon', ko: '수원' },
  { code: 'ulsan', en: 'Ulsan', ko: '울산' },
  { code: 'other', en: 'Other', ko: '기타' },
];