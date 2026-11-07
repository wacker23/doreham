/**
 * Map listings (Kakao Map) for venues. Client-safe: shapes returned by /api/places/search and
 * the listing claim, plus helpers that turn a listing into form suggestions.
 */

/** One Kakao Map place, as the server returns it. */
export type MapPlace = {
  /** Kakao place id (digits). */
  id: string;
  name: string;
  /** e.g. "음식점 > 카페 > 커피전문점" */
  category: string;
  /** Kakao group code, e.g. CE7 (café), FD6 (restaurant), CT1 (culture). */
  category_group: string;
  phone: string;
  road_address: string;
  address: string;
  lat: number;
  lng: number;
  /** https://place.map.kakao.com/<id> */
  url: string;
  /** Already linked to another venue on Doreham. */
  claimed?: boolean;
};

export type CheckResult = 'match' | 'different' | 'missing';

/** Matching the venue on Google Maps: found, no such place, or not tried successfully yet. */
export type GoogleMatch = { id: string | null; status: 'found' | 'none' | 'error' | 'off' | 'limit' };

/** What the server compared when a listing was linked. */
export type ListingCheck = {
  checked_at: string;
  by: 'owner' | 'admin';
  listing: Pick<MapPlace, 'name' | 'category' | 'phone' | 'road_address' | 'address' | 'lat' | 'lng'>;
  flags: { name: CheckResult; phone: CheckResult; address: CheckResult };
  /** Metres between the listing and the venue's address, when both are known. */
  distance_m: number | null;
  /** Last Google Maps search for this listing (retried by the cron when it failed). */
  google?: { status: GoogleMatch['status']; tried_at: string };
};

export const LISTING_ERRORS: Record<string, { en: string; ko: string }> = {
  listing_required: { en: 'Pick your business on Kakao Map first.', ko: '먼저 카카오맵에서 가게를 선택해 주세요.' },
  listing_not_found: { en: "We couldn't find that place on Kakao Map any more. Search again.", ko: '카카오맵에서 그 장소를 찾을 수 없어요. 다시 검색해 주세요.' },
  listing_taken: { en: 'This place is already registered on Doreham. If it’s yours, contact support@doreham.co.kr.', ko: '이미 도레함에 등록된 가게예요. 사장님 가게가 맞다면 support@doreham.co.kr로 알려 주세요.' },
  listing_too_far: { en: 'This listing is far from the address you entered. Check the address or pick another listing.', ko: '입력한 주소와 멀리 떨어진 장소예요. 주소를 확인하거나 다른 장소를 선택해 주세요.' },
  bad_naver_url: { en: 'That doesn’t look like a Naver Map link (map.naver.com or naver.me).', ko: '네이버 지도 링크가 아니에요 (map.naver.com 또는 naver.me).' },
  search_off: { en: 'Map search isn’t available right now. Please try again later.', ko: '지금은 지도 검색을 쓸 수 없어요. 잠시 후 다시 시도해 주세요.' },
  search_failed: { en: 'Map search failed. Please try again.', ko: '지도 검색에 실패했어요. 다시 시도해 주세요.' },
  query_too_short: { en: 'Type at least 2 characters.', ko: '2글자 이상 입력해 주세요.' },
};

export function listingError(code: string | null | undefined, lang: 'en' | 'ko'): string {
  const m = code ? LISTING_ERRORS[code] : undefined;
  if (m) return m[lang];
  return lang === 'ko' ? '문제가 생겼어요. 다시 시도해 주세요.' : 'Something went wrong. Please try again.';
}

/** A Naver Map link the owner may add (optional). Same rule as the database check. */
export function isNaverMapUrl(u: string): boolean {
  return (
    u.length <= 300 &&
    /^https:\/\/(map\.naver\.com|m\.map\.naver\.com|naver\.me|place\.naver\.com|m\.place\.naver\.com|pcmap\.place\.naver\.com)\/[^\s"<>]*$/.test(u)
  );
}

/** Doreham venue category suggested by a Kakao category (the owner can change it). */
export function suggestCategory(place: Pick<MapPlace, 'category' | 'category_group'>): string | null {
  const c = place.category ?? '';
  const has = (...words: string[]) => words.some((w) => c.includes(w));
  if (has('보드카페', '보드게임')) return 'board_game_cafe';
  if (has('방탈출')) return 'escape_room';
  if (has('서점', '책방', '북카페')) return 'bookshop';
  if (has('술집', '호프', '요리주점', '와인바', '칵테일바', '바(BAR)', '클럽', '이자카야', '포장마차')) return 'bar_club';
  if (has('공방', '공예', '원데이클래스', '체험')) return 'workshop_creative';
  if (has('스포츠', '레저', '볼링', '클라이밍', '당구', '탁구', '골프', '수영', '헬스')) return 'active_sports';
  if (has('영화', '노래방', '코인노래', '공연', '음악')) return 'music_movie';
  if (has('공원', '산', '계곡', '해수욕장', '수목원', '캠핑')) return 'nature_outdoor';
  if (has('미술관', '박물관', '전시', '갤러리', '문화')) return 'cultural_venue';
  if (place.category_group === 'CE7' || has('카페')) return 'cafe';
  if (place.category_group === 'FD6' || has('음식점')) return 'restaurant';
  if (place.category_group === 'CT1') return 'cultural_venue';
  return null;
}

/** City code (venues.city) from a Kakao address like "충남 아산시 탕정면 …". */
export function cityFromAddress(address: string): string {
  const [sido = '', sigungu = ''] = address.trim().split(/\s+/);
  if (sido.includes('서울')) return 'seoul';
  if (sido.includes('부산')) return 'busan';
  if (sido.includes('인천')) return 'incheon';
  if (sido.includes('대구')) return 'daegu';
  if (sido.includes('대전')) return 'daejeon';
  if (sido.includes('광주') && !sido.includes('경기')) return 'gwangju';
  if (sido.includes('울산')) return 'ulsan';
  if (sigungu.includes('아산')) return 'asan';
  if (sigungu.includes('천안')) return 'cheonan';
  if (sigungu.includes('수원')) return 'suwon';
  return 'other';
}

/** 동/읍/면 from a lot-number address ("충남 아산시 탕정면 매곡리 123" → "탕정면"), like the address search gives. */
export function districtFromAddress(address: string): string {
  const parts = address.trim().split(/\s+/);
  const hit = parts.slice(1).find((p) => /(동|읍|면|가)$/.test(p) && !/(시|군|구)$/.test(p));
  return hit ?? '';
}
