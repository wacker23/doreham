'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function Footer() {
  const pathname = usePathname();
  const [lang, setLang] = useState<'en' | 'ko'>('en');

  useEffect(() => {
    // Read lang from body attribute (set by other pages)
    const bodyLang = document.body.getAttribute('data-lang');
    if (bodyLang === 'ko' || bodyLang === 'en') setLang(bodyLang);

    // Watch for changes to data-lang
    const observer = new MutationObserver(() => {
      const newLang = document.body.getAttribute('data-lang');
      if (newLang === 'ko' || newLang === 'en') setLang(newLang);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-lang'] });
    return () => observer.disconnect();
  }, []);

  // Hide footer on certain pages where it would clutter UX
  const hiddenPaths = [
    '/',
    '/signup',
    '/matches',
    '/onboarding',
    '/sign-in',
    '/auth/callback',
    '/auth/error',
  ];

  // Also hide on chat pages (/matches/[group_id]/chat)
  const isChatPage = pathname?.match(/^\/matches\/[^/]+\/chat/);
  const isHidden = hiddenPaths.includes(pathname ?? '') || isChatPage;

  if (isHidden) return null;

  return (
    <footer className="site-footer">
      <div className="wrap footer-in">
        <div className="footer-brand">
          Doreham <span className="ko-mark">도레함</span>
        </div>
        <div className="footer-links">
          <a href="/legal/privacy">
            {lang === 'ko' ? '개인정보 처리방침' : 'Privacy'}
          </a>
          <span className="sep">·</span>
          <a href="/legal/terms">
            {lang === 'ko' ? '이용약관' : 'Terms'}
          </a>
          <span className="sep">·</span>
          <a href="mailto:support@doreham.co.kr">
            {lang === 'ko' ? '문의' : 'Contact'}
          </a>
        </div>
        <div className="footer-copy">
          © 2026 Doreham
        </div>
      </div>

      <style jsx>{`
        .site-footer {
          border-top: 1px solid var(--ink-12);
          background: var(--paper-2);
          padding: 20px 0;
          margin-top: 40px;
        }
        .footer-in {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 13px;
          color: var(--ink-60);
        }
        .footer-brand {
          font-family: var(--display);
          font-weight: 800;
          color: var(--ink);
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .ko-mark {
          font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
          color: var(--ink-60);
          font-weight: 700;
          font-size: 12px;
        }
        .footer-links {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .footer-links a {
          color: var(--ink-60);
          text-decoration: none;
          font-weight: 500;
        }
        .footer-links a:hover {
          color: var(--persimmon);
        }
        .sep {
          color: var(--ink-12);
        }
        .footer-copy {
          color: var(--ink-60);
        }
        @media (max-width: 640px) {
          .footer-in {
            flex-direction: column;
            text-align: center;
            gap: 8px;
          }
        }
      `}</style>
    </footer>
  );
}