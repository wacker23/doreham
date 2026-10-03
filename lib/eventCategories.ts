/** Event categories for the community Events page. Client-safe. */
import type { CategoryArt } from '@/lib/icons';

export type EventCategory = {
  slug: string;
  /** Category artwork (public/categories). */
  art: CategoryArt;
  label_en: string;
  label_ko: string;
};

export const EVENT_CATEGORIES: EventCategory[] = [
  { slug: 'social', art: 'coffee', label_en: 'Hang out', label_ko: '친목' },
  { slug: 'language', art: 'chat', label_en: 'Language exchange', label_ko: '언어 교환' },
  { slug: 'food', art: 'food', label_en: 'Food & drinks', label_ko: '맛집 · 음식' },
  { slug: 'outdoor', art: 'adventure', label_en: 'Outdoors & sports', label_ko: '야외 · 운동' },
  { slug: 'culture', art: 'makethings', label_en: 'Culture & arts', label_ko: '문화 · 예술' },
  { slug: 'games', art: 'game', label_en: 'Games', label_ko: '게임' },
  { slug: 'study', art: 'network', label_en: 'Study & career', label_ko: '스터디 · 커리어' },
  { slug: 'volunteer', art: 'help', label_en: 'Volunteering', label_ko: '봉사' },
  { slug: 'nightlife', art: 'nightout', label_en: 'Night out', label_ko: '나이트아웃' },
  { slug: 'other', art: 'other', label_en: 'Other', label_ko: '기타' },
];

export const EVENT_CATEGORY_SLUGS = new Set(EVENT_CATEGORIES.map((c) => c.slug));

export function eventCategory(slug: string): EventCategory {
  return EVENT_CATEGORIES.find((c) => c.slug === slug) ?? EVENT_CATEGORIES[EVENT_CATEGORIES.length - 1];
}

export const EVENT_REPORT_REASONS = [
  { slug: 'spam', label_en: 'Spam or advertising', label_ko: '스팸 · 광고' },
  { slug: 'scam', label_en: 'Scam or selling', label_ko: '사기 · 판매' },
  { slug: 'unsafe', label_en: 'Unsafe (private place, pressure, dating)', label_ko: '안전하지 않음 (비공개 장소, 강요, 이성 만남 목적)' },
  { slug: 'offensive', label_en: 'Offensive or hateful', label_ko: '불쾌 · 혐오' },
  { slug: 'other', label_en: 'Something else', label_ko: '기타' },
] as const;
