'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type Profile = {
  id: string;
  display_name: string;
  photo_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  gender: string | null;
  home_district: string | null;
  primary_language: string | null;
  spoken_languages: string[] | null;
  mbti_type: string | null;
  zodiac_sign: string | null;
  activity_preferences: string[] | null;
  interests: string[] | null;
  social_energy: string | null;
  big_five_openness: number | null;
  big_five_conscientiousness: number | null;
  big_five_extraversion: number | null;
  big_five_agreeableness: number | null;
  big_five_neuroticism: number | null;
  onboarding_completed: boolean;
};

const MBTI_LABELS: Record<string, { en: string; ko: string }> = {
  INTJ: { en: 'The Architect', ko: '전략가' },
  INTP: { en: 'The Logician', ko: '논리술사' },
  ENTJ: { en: 'The Commander', ko: '통솔자' },
  ENTP: { en: 'The Debater', ko: '변론가' },
  INFJ: { en: 'The Advocate', ko: '옹호자' },
  INFP: { en: 'The Mediator', ko: '중재자' },
  ENFJ: { en: 'The Protagonist', ko: '선도자' },
  ENFP: { en: 'The Campaigner', ko: '활동가' },
  ISTJ: { en: 'The Logistician', ko: '현실주의자' },
  ISFJ: { en: 'The Defender', ko: '수호자' },
  ESTJ: { en: 'The Executive', ko: '경영자' },
  ESFJ: { en: 'The Consul', ko: '집정관' },
  ISTP: { en: 'The Virtuoso', ko: '장인' },
  ISFP: { en: 'The Adventurer', ko: '모험가' },
  ESTP: { en: 'The Entrepreneur', ko: '사업가' },
  ESFP: { en: 'The Entertainer', ko: '연예인' },
};

const ZODIAC: Record<string, { en: string; ko: string; symbol: string }> = {
  aries:       { en: 'Aries',       ko: '양자리',      symbol: '♈' },
  taurus:      { en: 'Taurus',      ko: '황소자리',    symbol: '♉' },
  gemini:      { en: 'Gemini',      ko: '쌍둥이자리',  symbol: '♊' },
  cancer:      { en: 'Cancer',      ko: '게자리',      symbol: '♋' },
  leo:         { en: 'Leo',         ko: '사자자리',    symbol: '♌' },
  virgo:       { en: 'Virgo',       ko: '처녀자리',    symbol: '♍' },
  libra:       { en: 'Libra',       ko: '천칭자리',    symbol: '♎' },
  scorpio:     { en: 'Scorpio',     ko: '전갈자리',    symbol: '♏' },
  sagittarius: { en: 'Sagittarius', ko: '궁수자리',    symbol: '♐' },
  capricorn:   { en: 'Capricorn',   ko: '염소자리',    symbol: '♑' },
  aquarius:    { en: 'Aquarius',    ko: '물병자리',    symbol: '♒' },
  pisces:      { en: 'Pisces',      ko: '물고기자리',  symbol: '♓' },
};

const ACTIVITY_LABELS: Record<string, { en: string; ko: string; emoji: string }> = {
  conversation_coffee:      { en: 'Coffee chats', ko: '커피 대화', emoji: '☕' },
  board_games_casual:       { en: 'Board games', ko: '보드게임', emoji: '🎲' },
  workshops_creative:       { en: 'Creative workshops', ko: '창작 클래스', emoji: '🏺' },
  active_outdoor:           { en: 'Active outdoors', ko: '야외 활동', emoji: '🥾' },
  food_dining:              { en: 'Food & dining', ko: '음식·식사', emoji: '🍜' },
  learning_culture:         { en: 'Learning culture', ko: '문화 배우기', emoji: '📚' },
  nature_calm:              { en: 'Nature calm', ko: '자연 힐링', emoji: '🌿' },
  escape_puzzles:           { en: 'Escape & puzzles', ko: '방탈출·퍼즐', emoji: '🧩' },
  movies_music_shows:       { en: 'Movies & music', ko: '영화·음악', emoji: '🎬' },
  career_networking:        { en: 'Career networking', ko: '커리어 네트워킹', emoji: '💼' },
  volunteering_community:   { en: 'Volunteering', ko: '봉사·커뮤니티', emoji: '🤝' },
  nightlife_social:         { en: 'Nightlife', ko: '나이트라이프', emoji: '🌃' },
};

const LANGUAGE_LABELS: Record<string, { en: string; ko: string; native: string }> = {
  en: { en: 'English', ko: '영어', native: 'English' },
  ko: { en: 'Korean', ko: '한국어', native: '한국어' },
  zh: { en: 'Chinese', ko: '중국어', native: '中文' },
  vi: { en: 'Vietnamese', ko: '베트남어', native: 'Tiếng Việt' },
  ja: { en: 'Japanese', ko: '일본어', native: '日本語' },
  tl: { en: 'Tagalog', ko: '타갈로그어', native: 'Tagalog' },
  th: { en: 'Thai', ko: '태국어', native: 'ภาษาไทย' },
  ru: { en: 'Russian', ko: '러시아어', native: 'Русский' },
  uz: { en: 'Uzbek', ko: '우즈베크어', native: 'Oʻzbek' },
  id: { en: 'Indonesian', ko: '인도네시아어', native: 'Bahasa Indonesia' },
  mn: { en: 'Mongolian', ko: '몽골어', native: 'Монгол' },
  ne: { en: 'Nepali', ko: '네팔어', native: 'नेपाली' },
  my: { en: 'Burmese', ko: '미얀마어', native: 'မြန်မာ' },
  km: { en: 'Khmer', ko: '크메르어', native: 'ខ្មែរ' },
  ur: { en: 'Urdu', ko: '우르두어', native: 'اردو' },
  hi: { en: 'Hindi', ko: '힌디어', native: 'हिन्दी' },
  bn: { en: 'Bengali', ko: '벵골어', native: 'বাংলা' },
  fa: { en: 'Persian', ko: '페르시아어', native: 'فارسی' },
  ar: { en: 'Arabic', ko: '아랍어', native: 'العربية' },
  tr: { en: 'Turkish', ko: '터키어', native: 'Türkçe' },
  es: { en: 'Spanish', ko: '스페인어', native: 'Español' },
  pt: { en: 'Portuguese', ko: '포르투갈어', native: 'Português' },
  fr: { en: 'French', ko: '프랑스어', native: 'Français' },
  de: { en: 'German', ko: '독일어', native: 'Deutsch' },
  it: { en: 'Italian', ko: '이탈리아어', native: 'Italiano' },
  pl: { en: 'Polish', ko: '폴란드어', native: 'Polski' },
  uk: { en: 'Ukrainian', ko: '우크라이나어', native: 'Українська' },
  kk: { en: 'Kazakh', ko: '카자흐어', native: 'Қазақ' },
  ky: { en: 'Kyrgyz', ko: '키르기스어', native: 'Кыргыз' },
  other: { en: 'Other', ko: '기타', native: '—' },
};

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function bigFiveLabels(profile: Profile, lang: 'en' | 'ko'): { emoji: string; label: string }[] {
  const labels: { emoji: string; label: string }[] = [];
  const e = profile.big_five_extraversion ?? 0.5;
  const o = profile.big_five_openness ?? 0.5;
  const a = profile.big_five_agreeableness ?? 0.5;
  const c = profile.big_five_conscientiousness ?? 0.5;
  const n = profile.big_five_neuroticism ?? 0.5;

  if (e >= 0.65) labels.push({ emoji: '⚡', label: lang === 'ko' ? '사교적 에너지' : 'Social energizer' });
  else if (e <= 0.35) labels.push({ emoji: '🌙', label: lang === 'ko' ? '조용한 관찰자' : 'Quiet observer' });

  if (o >= 0.65) labels.push({ emoji: '💡', label: lang === 'ko' ? '아이디어 탐험가' : 'Ideas explorer' });
  else if (o <= 0.35) labels.push({ emoji: '⚓', label: lang === 'ko' ? '든든한 뿌리' : 'Steady anchor' });

  if (a >= 0.65) labels.push({ emoji: '🌻', label: lang === 'ko' ? '따뜻함 전달자' : 'Warmth bringer' });
  else if (a <= 0.35) labels.push({ emoji: '🎯', label: lang === 'ko' ? '솔직한 목소리' : 'Direct voice' });

  if (c >= 0.65) labels.push({ emoji: '📋', label: lang === 'ko' ? '계획가' : 'Planner' });
  else if (c <= 0.35) labels.push({ emoji: '🎈', label: lang === 'ko' ? '자유로운 영혼' : 'Free spirit' });

  if (n >= 0.65) labels.push({ emoji: '🌊', label: lang === 'ko' ? '깊은 감정' : 'Deep feeler' });
  else if (n <= 0.35) labels.push({ emoji: '🗿', label: lang === 'ko' ? '흔들리지 않는 중심' : 'Steady center' });

  return labels;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canView, setCanView] = useState(false);

  const targetId = params?.id as string;

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/sign-in?return=/profile/${targetId}`);
      return;
    }
    checkAccessAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, targetId]);

  async function checkAccessAndLoad() {
    setLoading(true);
    setError(null);

    // Own profile — always allowed
    if (user!.id === targetId) {
      setCanView(true);
      await loadProfile();
      return;
    }

    // Check if user and target share a group
    const { data: sharedGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .in('user_id', [user!.id, targetId]);

    if (!sharedGroups || sharedGroups.length === 0) {
      setError(lang === 'ko' ? '이 프로필을 볼 권한이 없습니다.' : "You don't have permission to view this profile.");
      setLoading(false);
      return;
    }

    // Count occurrences of each group_id — if a group has 2 entries, both users are in it
    const groupCounts: Record<string, number> = {};
    for (const row of sharedGroups) {
      groupCounts[row.group_id] = (groupCounts[row.group_id] ?? 0) + 1;
    }

    const hasSharedGroup = Object.values(groupCounts).some((c) => c >= 2);

    if (!hasSharedGroup) {
      setError(lang === 'ko' ? '이 프로필을 볼 권한이 없습니다.' : "You don't have permission to view this profile.");
      setLoading(false);
      return;
    }

    setCanView(true);
    await loadProfile();
  }

  async function loadProfile() {
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setError(lang === 'ko' ? '프로필을 찾을 수 없습니다.' : 'Profile not found.');
      setLoading(false);
      return;
    }

    setProfile(data as Profile);
    setLoading(false);
  }

  if (authLoading || loading) {
    return (
      <main className="loading-wrap">
        <div className="loader" />
        <style jsx>{`
          .loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (error || !canView || !profile) {
    return (
      <>
        <header className="v-nav">
          <div className="wrap v-nav-in">
            <a className="brand" href="/">
              Doreham <span className="ko-mark">도레함</span>
            </a>
          </div>
        </header>
        <main className="wrap main-wrap">
          <div className="error-state">
            <div className="error-icon">🔒</div>
            <h2>{error ?? (lang === 'ko' ? '프로필을 볼 수 없습니다' : 'Cannot view profile')}</h2>
            <p>
              {lang === 'ko'
                ? '같은 그룹에 매칭된 사람의 프로필만 볼 수 있습니다.'
                : "You can only view profiles of people in your groups."}
            </p>
            <button onClick={() => router.back()} className="btn-primary">
              {lang === 'ko' ? '← 돌아가기' : '← Go back'}
            </button>
          </div>
        </main>
        <style jsx>{`
          .v-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); }
          .v-nav-in { display: flex; align-items: center; height: 68px; }
          .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
          .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
          .main-wrap { padding: 60px 24px; max-width: 500px; }
          .error-state { text-align: center; padding: 60px 20px; background: var(--paper-2); border-radius: 24px; }
          .error-icon { font-size: 56px; margin-bottom: 20px; }
          .error-state h2 { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 8px; }
          .error-state p { color: var(--ink-60); font-size: 15px; margin: 0 0 24px; }
          .btn-primary { background: var(--persimmon); color: #fff; border: 0; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
        `}</style>
      </>
    );
  }

  const isOwn = user?.id === profile.id;
  const mbti = profile.mbti_type ? MBTI_LABELS[profile.mbti_type] : null;
  const zodiac = profile.zodiac_sign ? ZODIAC[profile.zodiac_sign] : null;
  const age = profile.date_of_birth ? computeAge(profile.date_of_birth) : null;
  const bigFive = bigFiveLabels(profile, lang);
  const allActivities = [...(profile.activity_preferences ?? []), ...(profile.interests ?? [])];

  return (
    <>
      <header className="v-nav">
        <div className="wrap v-nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span>
          </a>
          <div className="toggle">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>

      <main className="wrap main-wrap">
        <button onClick={() => router.back()} className="back-btn">
          {lang === 'ko' ? '← 돌아가기' : '← Back'}
        </button>

        <div className="profile-hero">
          {profile.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.photo_url} alt="" className="hero-avatar" />
          ) : (
            <div className="hero-avatar avatar-fallback">
              {profile.display_name[0]?.toUpperCase()}
            </div>
          )}
          <div className="hero-info">
            <h1>
              {profile.display_name}
              {isOwn && (
                <span className="you-tag">
                  {lang === 'ko' ? '나' : 'you'}
                </span>
              )}
            </h1>
            {age !== null && (
              <p className="hero-age">
                {lang === 'ko' ? `${age}세` : `${age} years old`}
              </p>
            )}
            {profile.home_district && (
              <p className="hero-district">
                📍 {profile.home_district}
              </p>
            )}
          </div>
        </div>

        {profile.bio && (
          <div className="section">
            <h3>{lang === 'ko' ? '자기소개' : 'About'}</h3>
            <p className="bio">{profile.bio}</p>
          </div>
        )}

        {(mbti || zodiac) && (
          <div className="section">
            <h3>{lang === 'ko' ? '개성' : 'Personality'}</h3>
            <div className="personality-row">
              {mbti && profile.mbti_type && (
                <div className="personality-card">
                  <div className="card-code">{profile.mbti_type}</div>
                  <div className="card-label">
                    {lang === 'ko' ? mbti.ko : mbti.en}
                  </div>
                </div>
              )}
              {zodiac && (
                <div className="personality-card">
                  <div className="card-symbol">{zodiac.symbol}</div>
                  <div className="card-label">
                    {lang === 'ko' ? zodiac.ko : zodiac.en}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {bigFive.length > 0 && (
          <div className="section">
            <h3>{lang === 'ko' ? '특징' : 'Traits'}</h3>
            <div className="traits-grid">
              {bigFive.map((t, i) => (
                <div key={i} className="trait-pill">
                  <span className="trait-emoji">{t.emoji}</span>
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {allActivities.length > 0 && (
          <div className="section">
            <h3>{lang === 'ko' ? '좋아하는 활동' : 'Loves to do'}</h3>
            <div className="interests-grid">
              {allActivities.map((code) => {
                const info = ACTIVITY_LABELS[code];
                if (!info) return (
                  <div key={code} className="interest-pill">
                    {code.replace(/_/g, ' ')}
                  </div>
                );
                return (
                  <div key={code} className="interest-pill">
                    <span>{info.emoji}</span>
                    <span>{lang === 'ko' ? info.ko : info.en}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {profile.spoken_languages && profile.spoken_languages.length > 0 && (
          <div className="section">
            <h3>{lang === 'ko' ? '언어' : 'Languages'}</h3>
            <div className="languages-list">
              {profile.spoken_languages.map((code) => {
                const info = LANGUAGE_LABELS[code];
                if (!info) return <span key={code} className="lang-pill">{code}</span>;
                return (
                  <span key={code} className="lang-pill">
                    {info.native}
                    {info.native !== info.en && (
                      <span className="lang-sub">
                        {lang === 'ko' ? info.ko : info.en}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .v-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .v-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .brand .ko-mark { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .main-wrap { padding: 24px 24px 80px; max-width: 700px; }
        .back-btn { background: transparent; border: 0; color: var(--ink-60); font-family: var(--body); font-weight: 600; font-size: 14px; cursor: pointer; padding: 0 0 16px; }
        .back-btn:hover { color: var(--ink); }
        .profile-hero { display: flex; gap: 24px; align-items: center; padding: 32px; background: linear-gradient(135deg, rgba(255, 106, 61, 0.05), rgba(15, 157, 119, 0.03)); border-radius: 20px; margin-bottom: 20px; }
        .hero-avatar { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 4px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .avatar-fallback { background: var(--persimmon); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 42px; }
        .hero-info h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 6px; letter-spacing: -0.02em; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .you-tag { font-size: 12px; font-weight: 700; color: var(--persimmon); background: rgba(255, 106, 61, 0.15); padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; }
        .hero-age, .hero-district { color: var(--ink-60); font-size: 15px; margin: 4px 0; }
        .section { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px 24px; margin-bottom: 12px; }
        .section h3 { font-family: var(--display); font-weight: 700; font-size: 14px; margin: 0 0 14px; color: var(--ink); text-transform: uppercase; letter-spacing: 0.08em; }
        .bio { color: var(--ink); font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap; }
        .personality-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .personality-card { background: var(--paper-2); padding: 14px 20px; border-radius: 12px; min-width: 120px; text-align: center; }
        .card-code { font-family: var(--display); font-weight: 800; font-size: 20px; color: var(--persimmon); margin-bottom: 4px; }
        .card-symbol { font-size: 28px; margin-bottom: 4px; }
        .card-label { font-size: 12px; color: var(--ink-60); font-weight: 600; }
        .traits-grid { display: flex; gap: 8px; flex-wrap: wrap; }
        .trait-pill { display: flex; align-items: center; gap: 6px; background: var(--paper-2); padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--ink); }
        .trait-emoji { font-size: 16px; }
        .interests-grid { display: flex; gap: 8px; flex-wrap: wrap; }
        .interest-pill { display: flex; align-items: center; gap: 6px; background: rgba(15, 157, 119, 0.08); color: var(--jade); padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; }
        .languages-list { display: flex; gap: 8px; flex-wrap: wrap; }
        .lang-pill { background: var(--paper-2); padding: 8px 14px; border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--ink); display: flex; flex-direction: column; align-items: flex-start; }
        .lang-sub { font-size: 11px; color: var(--ink-60); font-weight: 500; }
        @media (max-width: 640px) {
          .profile-hero { flex-direction: column; text-align: center; }
          .hero-info h1 { justify-content: center; }
          .hero-avatar { width: 100px; height: 100px; }
        }
      `}</style>
    </>
  );
}