'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { UserMenu } from '@/components/UserMenu';
import { DoroSvg, HamiSvg } from '@/components/jellyfish';

type Lang = 'en' | 'ko';

export default function HomePage() {
  const router = useRouter();
  const { user, profile, loading } = useUser();
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (loading) return;

    // Not signed in → send to sign-in
    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Signed in but hasn't onboarded → send back to onboarding
    if (profile && !profile.onboarding_completed) {
      router.push('/onboarding');
      return;
    }
  }, [user, profile, loading, router]);

  if (loading || !user || (profile && !profile.onboarding_completed)) {
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

  const name = profile?.display_name ?? 'friend';

  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span>
          </a>
          <div className="nav-right">
            <div className="toggle" role="group" aria-label="Language">
              <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
              <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
            </div>
            <UserMenu lang={lang} />
          </div>
        </div>
      </header>

      <main className="home-wrap">
        <div className="wrap home-in">
          <div className="celebration">
            <div className="jellies">
              <DoroSvg />
              <HamiSvg />
            </div>

            <h1>
              <span className="en">You&apos;re all set, {name}!</span>
              <span className="ko lang-ko">{name}님, 준비 완료!</span>
            </h1>

            <p className="sub">
              <span className="en">
                Your profile is complete. Doro and Hami are getting your first
                matches ready — small groups, real activities, right where you are.
              </span>
              <span className="ko lang-ko">
                프로필이 완성되었습니다. 도로와 하미가 곧 첫 매칭을 준비할게요 —
                작은 그룹, 진짜 활동, 당신 근처에서.
              </span>
            </p>

            <div className="status-card">
              <div className="status-badge">
                <span className="pulse" />
                <span className="en">Matching coming soon</span>
                <span className="ko lang-ko">매칭 준비 중</span>
              </div>
              <p className="status-desc">
                <span className="en">
                  We&apos;re opening in Asan first, then Cheonan and Seoul.
                  You&apos;ll get an email when your city is live.
                </span>
                <span className="ko lang-ko">
                  아산에서 먼저 시작한 후, 천안과 서울로 확장됩니다.
                  당신의 도시가 열리면 이메일로 알려드릴게요.
                </span>
              </p>
            </div>

            <div className="next-steps">
              <h2>
                <span className="en">Meanwhile</span>
                <span className="ko lang-ko">그 동안</span>
              </h2>
              <div className="tips">
                <div className="tip">
                  <div className="tip-num">1</div>
                  <div>
                    <h3>
                      <span className="en">Tell a friend</span>
                      <span className="ko lang-ko">친구에게 알려주세요</span>
                    </h3>
                    <p>
                      <span className="en">
                        Doreham works best when the people around you join too.
                        Share doreham.co.kr with a friend who&apos;d get it.
                      </span>
                      <span className="ko lang-ko">
                        도레함은 주변 사람들이 함께할 때 가장 좋아요.
                        공감할 만한 친구에게 doreham.co.kr을 알려주세요.
                      </span>
                    </p>
                  </div>
                </div>
                <div className="tip">
                  <div className="tip-num">2</div>
                  <div>
                    <h3>
                      <span className="en">Follow along</span>
                      <span className="ko lang-ko">소식 받기</span>
                    </h3>
                    <p>
                      <span className="en">
                        We&apos;ll email you when matching goes live in your city
                        and share behind-the-scenes updates as we build.
                      </span>
                      <span className="ko lang-ko">
                        당신의 도시에서 매칭이 시작되면 이메일로 알려드리고,
                        만드는 과정도 함께 나눌게요.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .nav { position: sticky; top: 0; z-index: 50; background: rgba(245, 242, 235, 0.75); backdrop-filter: saturate(180%) blur(14px); -webkit-backdrop-filter: saturate(180%) blur(14px); border-bottom: 1px solid var(--ink-12); }
        .nav-in { display: flex; align-items: center; gap: 32px; height: 72px; }
        .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 22px; text-decoration: none; }
        .brand .ko-mark { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; color: var(--ink-60); font-weight: 700; font-size: 18px; }
        .nav-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }

        .home-wrap { padding: 60px 0 120px; }
        .home-in { max-width: 720px; }
        .celebration { text-align: center; animation: fadeUp 0.9s var(--ease-smooth, ease); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        .jellies {
          display: flex;
          justify-content: center;
          gap: -20px;
          margin-bottom: 32px;
        }
        .jellies :global(.jelly) {
          width: 130px;
          filter: drop-shadow(0 20px 40px rgba(30, 34, 48, 0.12));
        }
        .jellies :global(.jelly.doro) {
          transform: rotate(6deg);
          animation: floatA 6s ease-in-out infinite;
        }
        .jellies :global(.jelly.hami) {
          transform: rotate(-6deg) translateX(-20px);
          animation: floatB 6.6s ease-in-out infinite;
        }
        @keyframes floatA {
          0%, 100% { transform: rotate(6deg) translateY(0); }
          50% { transform: rotate(6deg) translateY(-14px); }
        }
        @keyframes floatB {
          0%, 100% { transform: rotate(-6deg) translateX(-20px) translateY(0); }
          50% { transform: rotate(-6deg) translateX(-20px) translateY(-10px); }
        }

        h1 {
          font-family: var(--display);
          font-weight: 800;
          font-size: clamp(32px, 5vw, 52px);
          letter-spacing: -0.02em;
          margin: 0 0 20px;
        }
        .sub {
          font-size: 18px;
          color: var(--ink-60);
          max-width: 46ch;
          margin: 0 auto 40px;
          line-height: 1.55;
        }

        .status-card {
          background: var(--paper-2);
          border: 1px solid var(--ink-12);
          border-radius: 24px;
          padding: 28px 32px;
          max-width: 460px;
          margin: 0 auto 60px;
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(255, 106, 61, 0.1);
          color: var(--persimmon);
          padding: 8px 16px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 14px;
        }
        .pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--persimmon);
          animation: pulseAnim 1.6s ease-in-out infinite;
        }
        @keyframes pulseAnim {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.6; }
        }
        .status-desc {
          font-size: 15px;
          color: var(--ink-60);
          line-height: 1.55;
        }

        .next-steps {
          max-width: 560px;
          margin: 0 auto;
          text-align: left;
        }
        .next-steps h2 {
          font-family: var(--display);
          font-weight: 800;
          font-size: 24px;
          text-align: center;
          margin: 0 0 28px;
          color: var(--ink);
        }
        .tips {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .tip {
          display: flex;
          gap: 20px;
          padding: 24px;
          background: var(--paper-2);
          border: 1px solid var(--ink-12);
          border-radius: 20px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .tip:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 28px rgba(30, 34, 48, 0.06);
        }
        .tip-num {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--persimmon);
          color: #fff;
          display: grid;
          place-items: center;
          font-family: var(--display);
          font-weight: 800;
          font-size: 18px;
        }
        .tip h3 {
          font-family: var(--display);
          font-weight: 800;
          font-size: 18px;
          margin: 0 0 6px;
          color: var(--ink);
        }
        .tip p {
          font-size: 14.5px;
          color: var(--ink-60);
          line-height: 1.5;
          margin: 0;
        }

        @media (max-width: 560px) {
          .home-wrap { padding: 40px 0 60px; }
          .jellies :global(.jelly) { width: 100px; }
          .status-card, .tip { padding: 20px; }
        }
      `}</style>
    </>
  );
}