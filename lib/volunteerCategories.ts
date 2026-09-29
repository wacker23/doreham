/**
 * English names for 1365 봉사분야 (srvcClCode values as the API returns them).
 * Client-safe. Unknown categories fall back to the Korean text.
 */
const CATEGORY_EN: Record<string, string> = {
  '문화ㆍ체육ㆍ예술ㆍ관광': 'Culture, sports, arts & tourism',
  '생활편의': 'Daily-life support',
  '기타': 'Other',
  '사무행정': 'Office support',
  '교육': 'Education',
  '보건ㆍ의료': 'Health care',
  '환경ㆍ생태계보호': 'Environment & nature',
  '상담ㆍ멘토링': 'Counseling & mentoring',
  '지역안전ㆍ보호': 'Community safety',
  '인권ㆍ공익': 'Human rights & public interest',
  '주거환경': 'Housing & neighborhood',
  '자원봉사 기본교육': 'Volunteer basics training',
  '국제협력ㆍ해외봉사': 'International cooperation',
  '농어촌 봉사': 'Farm & fishing village help',
  '재해ㆍ재난': 'Disaster relief',
};

export function volunteerCategoryLabel(category: string | null | undefined, lang: 'en' | 'ko'): string | null {
  if (!category) return null;
  if (lang === 'ko') return category;
  return CATEGORY_EN[category.trim()] ?? category;
}

export function volunteerCategoryEn(category: string | null | undefined): string | null {
  if (!category) return null;
  return CATEGORY_EN[category.trim()] ?? null;
}
