'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { isVenueAccount } from '@/lib/accountType';
import { useLang } from '@/lib/hooks/useLang';
import { AppHeader } from '@/components/AppHeader';
import { AppTabBar } from '@/components/AppTabBar';
import { DoroSvg, HamiSvg } from '@/components/jellyfish';

export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading } = useUser();
  const [lang, setLang] = useLang();

  useEffect(() => {
    if (loading) return;

    // Not signed in → send to sign-in
    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Signed in but hasn't done basic signup → send to signup
    if (profile && !profile.basic_signup_completed) {
      router.push('/signup');
      return;
    }

    // Venue-only account: no friend profile needed; their home is My venues
    if (profile && isVenueAccount(profile) && !profile.onboarding_completed) {
      router.push('/venues/my');
      return;
    }

    // Signed in, basic signup done, but hasn't onboarded → send to onboarding
    if (profile && !profile.onboarding_completed) {
      router.push('/onboarding');
      return;
    }

    // If they didn't come from signup/onboarding (no ?welcome=true), send them to matches
    const params = new URLSearchParams(window.location.search);
    if (!params.get('welcome')) {
      router.push('/');
      return;
    }
  }, [user, profile, loading, router]);

  if (loading || !user || (profile && !profile.onboarding_completed) || (profile && !profile.basic_signup_completed)) {
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

  const name = profile?.display_name ?? (lang === 'ko' ? '친구' : 'friend');
  const ko = lang === 'ko';

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />

      <main className="home-wrap">
        <div className="celebration">
          <div className="jellies" aria-hidden="true">
            <DoroSvg />
            <HamiSvg />
          </div>

          <h1>{ko ? `${name}님, 준비 완료!` : `You're all set, ${name}!`}</h1>

          <p className="sub">
            {ko
              ? '프로필이 완성됐어요. 매칭을 요청하면 도로와 하미가 근처에서 잘 맞는 2~5명을 찾아드려요.'
              : 'Your profile is ready. Ask for a match and Doro and Hami will find 2 to 5 people near you who fit you.'}
          </p>

          <a className="cta" href="/matches">
            {ko ? '첫 그룹 찾기 →' : 'Find my first group →'}
          </a>

          <div className="next">
            <a className="next-card" href="/events">
              <span className="next-ic" aria-hidden="true">🎉</span>
              <span className="next-text">
                <strong>{ko ? '이벤트' : 'Events'}</strong>
                <span>{ko ? '우리 도시에서 열리는 모임을 보거나 직접 열어 보세요.' : "See what's on in your city, or host your own."}</span>
              </span>
              <span className="next-arrow" aria-hidden="true">→</span>
            </a>
            <a className="next-card" href={`/profile/${user.id}`}>
              <span className="next-ic" aria-hidden="true">📸</span>
              <span className="next-text">
                <strong>{ko ? '내 프로필' : 'Your profile'}</strong>
                <span>{ko ? '사진을 올리면 그룹 친구들이 알아보기 쉬워요.' : 'Add a photo so your group can recognise you.'}</span>
              </span>
              <span className="next-arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </main>

      <AppTabBar lang={lang} />

      <style jsx>{`
        .home-wrap { padding: 40px 16px 96px; }
        .celebration { max-width: 560px; margin: 0 auto; text-align: center; animation: fadeUp 0.9s var(--ease-smooth, ease); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .jellies { display: flex; justify-content: center; margin-bottom: 24px; }
        .jellies :global(.jelly) { width: 120px; max-width: 32vw; filter: drop-shadow(0 20px 40px rgba(30, 34, 48, 0.12)); }
        .jellies :global(.jelly.doro) { transform: rotate(6deg); animation: floatA 6s ease-in-out infinite; }
        .jellies :global(.jelly.hami) { transform: rotate(-6deg) translateX(-20px); animation: floatB 6.6s ease-in-out infinite; }
        @keyframes floatA {
          0%, 100% { transform: rotate(6deg) translateY(0); }
          50% { transform: rotate(6deg) translateY(-14px); }
        }
        @keyframes floatB {
          0%, 100% { transform: rotate(-6deg) translateX(-20px) translateY(0); }
          50% { transform: rotate(-6deg) translateX(-20px) translateY(-10px); }
        }

        h1 { font-family: var(--display); font-weight: 800; font-size: clamp(28px, 6vw, 48px); letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 14px; color: var(--ink); overflow-wrap: anywhere; }
        .sub { font-size: 16.5px; color: var(--ink-60); max-width: 44ch; margin: 0 auto 26px; line-height: 1.55; }
        .cta { display: inline-block; background: var(--persimmon); color: #fff; font-weight: 800; font-size: 16px; border-radius: 999px; padding: 14px 28px; text-decoration: none; box-shadow: 0 8px 22px rgba(255, 106, 61, 0.28); }
        .cta:hover { transform: translateY(-1px); }

        .next { display: grid; gap: 12px; margin-top: 36px; text-align: left; }
        .next-card { display: flex; align-items: center; gap: 14px; background: #fff; border: 1px solid var(--ink-12); border-radius: 18px; padding: 16px 18px; text-decoration: none; color: var(--ink); }
        .next-card:hover { border-color: var(--ink-60); }
        .next-ic { width: 44px; height: 44px; flex: none; border-radius: 14px; background: var(--paper-2); display: grid; place-items: center; font-size: 22px; }
        .next-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; font-size: 14px; color: var(--ink-60); line-height: 1.45; }
        .next-text strong { font-size: 16px; color: var(--ink); }
        .next-arrow { color: var(--persimmon); font-weight: 800; font-size: 18px; }

        @media (min-width: 600px) {
          .home-wrap { padding-top: 60px; }
          .jellies :global(.jelly) { width: 130px; }
        }
      `}</style>
    </>
  );
}
