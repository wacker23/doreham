'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';

type Props = {
  lang: 'en' | 'ko';
};

/**
 * Renders in the nav.
 * - When NOT signed in: shows "Sign in / 로그인" link
 * - When signed in: shows the user's display name + dropdown with sign-out
 */
export function UserMenu({ lang }: Props) {
  const { user, profile, loading } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setMenuOpen(false);
    setSigningOut(false);
    // onAuthStateChange in useUser will pick up the change automatically.
    // Redirect to homepage to feel clean.
    window.location.href = '/';
  }

  if (loading) {
    return <div className="user-menu-placeholder" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <a href="/sign-in" className="user-menu-signin">
        <span className="en">Sign in</span>
        <span className="ko lang-ko">로그인</span>
        <style jsx>{`
          .user-menu-signin {
            font-family: var(--body);
            font-weight: 600;
            font-size: 14px;
            color: var(--ink);
            text-decoration: none;
            padding: 8px 14px;
            border-radius: 999px;
            border: 1px solid var(--ink-12);
            transition: background 0.12s;
          }
          .user-menu-signin:hover {
            background: var(--paper-2);
          }
        `}</style>
      </a>
    );
  }

  // Signed in — show name + dropdown
  const displayName = profile?.display_name ?? 'You';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="user-menu-wrap">
      <button
        className="user-menu-trigger"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        {profile?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.photo_url}
            alt=""
            className="user-menu-avatar"
          />
        ) : (
          <span className="user-menu-avatar user-menu-avatar-fallback">
            {initials || '?'}
          </span>
        )}
        <span className="user-menu-name">{displayName}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          style={{
            transform: menuOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {menuOpen && (
        <div className="user-menu-dropdown" role="menu">
          {!profile?.onboarding_completed && (
            <a
              href="/onboarding"
              className="user-menu-item user-menu-item-highlight"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
            >
              <span className="en">Complete your profile →</span>
              <span className="ko lang-ko">프로필 완성하기 →</span>
            </a>
          )}
          <button
            className="user-menu-item"
            onClick={handleSignOut}
            disabled={signingOut}
            role="menuitem"
          >
            {signingOut ? (
              <span>
                {lang === 'ko' ? '로그아웃 중…' : 'Signing out…'}
              </span>
            ) : (
              <>
                <span className="en">Sign out</span>
                <span className="ko lang-ko">로그아웃</span>
              </>
            )}
          </button>
        </div>
      )}

      <style jsx>{`
        .user-menu-wrap {
          position: relative;
        }
        .user-menu-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px 5px 5px;
          background: var(--paper-2);
          border: 1px solid var(--ink-12);
          border-radius: 999px;
          font-family: var(--body);
          font-weight: 600;
          font-size: 14px;
          color: var(--ink);
          cursor: pointer;
          transition: background 0.12s;
        }
        .user-menu-trigger:hover {
          background: rgba(30, 34, 48, 0.06);
        }
        .user-menu-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
          background: var(--persimmon);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-weight: 700;
          font-size: 12px;
        }
        .user-menu-avatar-fallback {
          display: inline-flex;
        }
        .user-menu-name {
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .user-menu-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 220px;
          background: #fff;
          border: 1px solid var(--ink-12);
          border-radius: 14px;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          z-index: 60;
        }
        .user-menu-item {
          display: block;
          width: 100%;
          text-align: left;
          padding: 12px 16px;
          font-family: var(--body);
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
          background: transparent;
          border: 0;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.1s;
        }
        .user-menu-item:hover:not(:disabled) {
          background: var(--paper-2);
        }
        .user-menu-item:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .user-menu-item-highlight {
          color: var(--persimmon);
          font-weight: 700;
          border-bottom: 1px solid var(--ink-12);
        }
        .user-menu-placeholder {
          width: 60px;
          height: 40px;
        }
        @media (max-width: 560px) {
          .user-menu-name {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}