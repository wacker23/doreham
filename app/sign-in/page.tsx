'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Lang = 'en' | 'ko';

export default function SignInPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [busy, setBusy] = useState<null | 'kakao' | 'google'>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSignIn(provider: 'kakao' | 'google') {
    setBusy(provider);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setBusy(null);
      setErrorMsg(
        lang === 'ko'
          ? '로그인 중 문제가 발생했습니다. 다시 시도해주세요.'
          : 'Sign-in failed. Please try again.'
      );
    }
    // On success, browser is redirected to provider. No further code runs here.
  }

  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span>
          </a>
          <div className="nav-right">
            <div className="toggle" role="group" aria-label="Language">
              <button
                aria-pressed={lang === 'ko'}
                onClick={() => setLang('ko')}
              >
                한국어
              </button>
              <button
                aria-pressed={lang === 'en'}
                onClick={() => setLang('en')}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="signin-wrap">
        <div className="signin-card">
          <h1 className="signin-h">
            <span className="en">Welcome to Doreham</span>
            <span className="ko lang-ko">도레함에 오신 것을 환영합니다</span>
          </h1>
          <p className="signin-sub">
            <span className="en">
              Sign in to start finding your people.
            </span>
            <span className="ko lang-ko">
              로그인하고 당신의 사람들을 찾아보세요.
            </span>
          </p>

          <div className="signin-buttons">
            <button
              className="btn-kakao"
              onClick={() => handleSignIn('kakao')}
              disabled={busy !== null}
            >
              <KakaoLogo />
              {busy === 'kakao' ? (
                <span>
                  {lang === 'ko' ? '이동 중…' : 'Redirecting…'}
                </span>
              ) : (
                <>
                  <span className="en">Continue with Kakao</span>
                  <span className="ko lang-ko">카카오로 시작하기</span>
                </>
              )}
            </button>

            <button
              className="btn-google"
              onClick={() => handleSignIn('google')}
              disabled={busy !== null}
            >
              <GoogleLogo />
              {busy === 'google' ? (
                <span>
                  {lang === 'ko' ? '이동 중…' : 'Redirecting…'}
                </span>
              ) : (
                <>
                  <span className="en">Continue with Google</span>
                  <span className="ko lang-ko">구글로 시작하기</span>
                </>
              )}
            </button>
          </div>

          {errorMsg && (
            <div className="signin-error" role="alert">
              {errorMsg}
            </div>
          )}

          <p className="signin-tos">
            <span className="en">
              By continuing, you agree to Doreham&apos;s terms of service and
              privacy policy.
            </span>
            <span className="ko lang-ko">
              계속 진행하시면 도레함의 서비스 약관과 개인정보 처리방침에 동의하는
              것으로 간주됩니다.
            </span>
          </p>
        </div>
      </main>

      <style jsx>{`
        .signin-wrap {
          min-height: calc(100vh - 68px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }
        .signin-card {
          max-width: 420px;
          width: 100%;
          text-align: center;
        }
        .signin-h {
          font-family: var(--display);
          font-weight: 800;
          font-size: clamp(28px, 4vw, 40px);
          letter-spacing: -0.02em;
          margin: 0 0 12px;
        }
        .signin-sub {
          color: var(--ink-60);
          font-size: 17px;
          margin: 0 0 36px;
        }
        .signin-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .btn-kakao,
        .btn-google {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 20px;
          border-radius: 999px;
          font-family: var(--body);
          font-weight: 700;
          font-size: 15px;
          border: 1px solid var(--ink-12);
          cursor: pointer;
          transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s;
        }
        .btn-kakao {
          background: #FEE500;
          color: #191600;
          border-color: #FEE500;
        }
        .btn-google {
          background: #ffffff;
          color: var(--ink);
        }
        .btn-kakao:hover:not(:disabled),
        .btn-google:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(0, 0, 0, 0.08);
        }
        .btn-kakao:disabled,
        .btn-google:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .signin-error {
          margin-top: 18px;
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 14px;
          background: rgba(255, 106, 61, 0.1);
          color: var(--persimmon);
          border: 1px solid rgba(255, 106, 61, 0.25);
        }
        .signin-tos {
          margin-top: 32px;
          color: var(--ink-60);
          font-size: 13px;
          line-height: 1.5;
        }
      `}</style>
    </>
  );
}

function KakaoLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3C6.48 3 2 6.48 2 10.8c0 2.79 1.83 5.24 4.6 6.63l-1.15 4.2c-.1.36.3.66.6.45l4.98-3.28c.32.03.65.05.97.05 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"
        fill="#191600"
      />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
