'use client';

import { useLang } from '@/lib/hooks/useLang';
import { Icon } from '@/components/icons/Icon';

/** Where /auth/callback sends you when Google/Kakao sign-in didn't finish. */
export default function AuthErrorPage() {
  const [lang, setLang] = useLang();
  const ko = lang === 'ko';

  return (
    <>
      <header className="ae-nav">
        <div className="ae-nav-in">
          <a className="ae-brand" href="/">
            Doreham <span className="ae-ko">도레함</span>
          </a>
          <div className="ae-toggle" role="group" aria-label="Language">
            <button aria-pressed={ko} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={!ko} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>
      <main className="ae-wrap">
        <div className="ae-card">
          <div className="ae-ic" aria-hidden="true"><Icon name="key" size={48} /></div>
          <h1>{ko ? '로그인이 끝나지 않았어요' : "Sign-in didn't finish"}</h1>
          <p>
            {ko
              ? '로그인 창을 닫았거나 시간이 너무 오래 걸리면 이렇게 될 수 있어요. 아무것도 바뀌지 않았어요. 다시 시도해 주세요.'
              : 'This can happen if the sign-in window was closed or took too long. Nothing was changed. Please try again.'}
          </p>
          <a className="ae-btn" href="/sign-in">{ko ? '다시 로그인하기' : 'Try again'}</a>
        </div>
      </main>
      <style jsx>{`
        .ae-nav { border-bottom: 1px solid var(--ink-12); background: rgba(245, 242, 235, 0.9); }
        .ae-nav-in { display: flex; align-items: center; justify-content: space-between; height: 64px; max-width: 1160px; margin: 0 auto; padding: 0 16px; }
        .ae-brand { font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .ae-ko { color: var(--ink-60); font-size: 16px; }
        .ae-toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .ae-toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .ae-toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .ae-wrap { min-height: calc(100vh - 65px); display: flex; align-items: center; justify-content: center; padding: 32px 16px; }
        .ae-card { max-width: 420px; width: 100%; text-align: center; background: #fff; border: 1px solid var(--ink-12); border-radius: 20px; padding: 32px 24px; }
        .ae-ic { display: flex; justify-content: center; margin-bottom: 8px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 24px; margin: 0 0 10px; color: var(--ink); }
        p { color: var(--ink-60); font-size: 15px; line-height: 1.55; margin: 0 0 20px; }
        .ae-btn { display: inline-block; background: var(--persimmon); color: #fff; font-weight: 700; font-size: 15px; border-radius: 999px; padding: 12px 24px; text-decoration: none; }
      `}</style>
    </>
  );
}
