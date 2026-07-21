// Shared TypeScript types for the Doreham onboarding flow.
// Column names match the ACTUAL Supabase schema exactly.

export type Gender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

export type SocialEnergyPref =
  | 'wants_conversation_starter'
  | 'matches_my_energy'
  | 'no_preference';

export type ActivityCategory =
  | 'conversation_coffee'
  | 'board_games_casual'
  | 'workshops_creative'
  | 'active_outdoor'
  | 'food_dining'
  | 'learning_culture'
  | 'nature_calm'
  | 'escape_puzzles'
  | 'movies_music_shows'
  | 'career_networking'
  | 'volunteering_community'
  | 'nightlife_social';

export type UiLanguage = 'en' | 'ko';

export type SpokenLanguage =
  | 'en' | 'ko' | 'zh' | 'vi' | 'ja' | 'tl' | 'th' | 'ru' | 'uz' | 'id'
  | 'mn' | 'ne' | 'my' | 'km' | 'ur' | 'hi' | 'bn' | 'fa' | 'ar' | 'tr'
  | 'es' | 'pt' | 'fr' | 'de' | 'it' | 'pl' | 'uk' | 'kk' | 'ky' | 'other';

// The 16 MBTI types
export type MbtiType =
  | 'INTJ' | 'INTP' | 'ENTJ' | 'ENTP'
  | 'INFJ' | 'INFP' | 'ENFJ' | 'ENFP'
  | 'ISTJ' | 'ISFJ' | 'ESTJ' | 'ESFJ'
  | 'ISTP' | 'ISFP' | 'ESTP' | 'ESFP';

// The 17 zodiac signs, including Ophiuchus 
export type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export type OnboardingFormData = {
  display_name?: string;
  date_of_birth?: string;
  gender?: Gender;
  primary_language?: SpokenLanguage;
  spoken_languages?: SpokenLanguage[];
  mbti_type?: MbtiType | null;
  zodiac_sign?: ZodiacSign | null;
  home_district?: string;
  activity_preferences?: ActivityCategory[];
  social_energy?: SocialEnergyPref;
  big_five_openness?: number;
  big_five_conscientiousness?: number;
  big_five_extraversion?: number;
  big_five_agreeableness?: number;
  big_five_neuroticism?: number;
  bio?: string | null;
  job_title?: string | null;
};

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 ;

export const TOTAL_STEPS = 6;

export const SPOKEN_LANGUAGES: {
  code: SpokenLanguage;
  en: string;
  ko: string;
  native: string;
}[] = [
  { code: 'en', en: 'English', ko: '영어', native: 'English' },
  { code: 'ko', en: 'Korean', ko: '한국어', native: '한국어' },
  { code: 'zh', en: 'Chinese (Mandarin)', ko: '중국어', native: '中文' },
  { code: 'vi', en: 'Vietnamese', ko: '베트남어', native: 'Tiếng Việt' },
  { code: 'ja', en: 'Japanese', ko: '일본어', native: '日本語' },
  { code: 'tl', en: 'Tagalog / Filipino', ko: '타갈로그어', native: 'Tagalog' },
  { code: 'th', en: 'Thai', ko: '태국어', native: 'ภาษาไทย' },
  { code: 'ru', en: 'Russian', ko: '러시아어', native: 'Русский' },
  { code: 'uz', en: 'Uzbek', ko: '우즈베크어', native: 'Oʻzbek' },
  { code: 'id', en: 'Indonesian', ko: '인도네시아어', native: 'Bahasa Indonesia' },
  { code: 'mn', en: 'Mongolian', ko: '몽골어', native: 'Монгол' },
  { code: 'ne', en: 'Nepali', ko: '네팔어', native: 'नेपाली' },
  { code: 'my', en: 'Burmese', ko: '미얀마어', native: 'မြန်မာ' },
  { code: 'km', en: 'Khmer', ko: '크메르어', native: 'ខ្មែរ' },
  { code: 'ur', en: 'Urdu', ko: '우르두어', native: 'اردو' },
  { code: 'hi', en: 'Hindi', ko: '힌디어', native: 'हिन्दी' },
  { code: 'bn', en: 'Bengali', ko: '벵골어', native: 'বাংলা' },
  { code: 'fa', en: 'Persian / Farsi', ko: '페르시아어', native: 'فارسی' },
  { code: 'ar', en: 'Arabic', ko: '아랍어', native: 'العربية' },
  { code: 'tr', en: 'Turkish', ko: '터키어', native: 'Türkçe' },
  { code: 'es', en: 'Spanish', ko: '스페인어', native: 'Español' },
  { code: 'pt', en: 'Portuguese', ko: '포르투갈어', native: 'Português' },
  { code: 'fr', en: 'French', ko: '프랑스어', native: 'Français' },
  { code: 'de', en: 'German', ko: '독일어', native: 'Deutsch' },
  { code: 'it', en: 'Italian', ko: '이탈리아어', native: 'Italiano' },
  { code: 'pl', en: 'Polish', ko: '폴란드어', native: 'Polski' },
  { code: 'uk', en: 'Ukrainian', ko: '우크라이나어', native: 'Українська' },
  { code: 'kk', en: 'Kazakh', ko: '카자흐어', native: 'Қазақ' },
  { code: 'ky', en: 'Kyrgyz', ko: '키르기스어', native: 'Кыргыз' },
  { code: 'other', en: 'Other', ko: '기타', native: '—' },
];

// The 16 MBTI types with 16personalities-style descriptive labels.
// Order follows the 4 role groups (Analysts → Diplomats → Sentinels → Explorers)
// which is the standard way Korean MBTI content presents them.
export const MBTI_OPTIONS: {
  code: MbtiType;
  en: string;
  ko: string;
}[] = [
  // Analysts (NT)
  { code: 'INTJ', en: 'INTJ · The Architect', ko: 'INTJ · 전략가' },
  { code: 'INTP', en: 'INTP · The Logician', ko: 'INTP · 논리술사' },
  { code: 'ENTJ', en: 'ENTJ · The Commander', ko: 'ENTJ · 통솔자' },
  { code: 'ENTP', en: 'ENTP · The Debater', ko: 'ENTP · 변론가' },
  // Diplomats (NF)
  { code: 'INFJ', en: 'INFJ · The Advocate', ko: 'INFJ · 옹호자' },
  { code: 'INFP', en: 'INFP · The Mediator', ko: 'INFP · 중재자' },
  { code: 'ENFJ', en: 'ENFJ · The Protagonist', ko: 'ENFJ · 선도자' },
  { code: 'ENFP', en: 'ENFP · The Campaigner', ko: 'ENFP · 활동가' },
  // Sentinels (SJ)
  { code: 'ISTJ', en: 'ISTJ · The Logistician', ko: 'ISTJ · 현실주의자' },
  { code: 'ISFJ', en: 'ISFJ · The Defender', ko: 'ISFJ · 수호자' },
  { code: 'ESTJ', en: 'ESTJ · The Executive', ko: 'ESTJ · 경영자' },
  { code: 'ESFJ', en: 'ESFJ · The Consul', ko: 'ESFJ · 집정관' },
  // Explorers (SP)
  { code: 'ISTP', en: 'ISTP · The Virtuoso', ko: 'ISTP · 장인' },
  { code: 'ISFP', en: 'ISFP · The Adventurer', ko: 'ISFP · 모험가' },
  { code: 'ESTP', en: 'ESTP · The Entrepreneur', ko: 'ESTP · 사업가' },
  { code: 'ESFP', en: 'ESFP · The Entertainer', ko: 'ESFP · 연예인' },
];
