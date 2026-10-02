/**
 * Two kinds of account, one sign-in:
 * - member: joined to meet people (friend profile: languages, MBTI, quiz…).
 * - venue:  signed up only to list a venue. No friend profile, never matched, not in groups.
 *           Becomes a member when they choose "Meet people too" and finish the friend profile.
 */
export type AccountType = 'member' | 'venue';

export function isVenueAccount(p: { account_type?: string | null } | null | undefined): boolean {
  return p?.account_type === 'venue';
}

/** Where "make my friend profile" starts for a venue account (name is kept, then gender, birthday…). */
export const MEET_PEOPLE_HREF = '/signup?as=member';

// The choice made before sign-in ("Register my venue" on the landing page) has to survive the
// Kakao/Google round trip, so it waits in localStorage for a couple of hours.
const KEY = 'doreham_signup_as';
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function rememberSignupAs(as: AccountType) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ as, at: Date.now() }));
  } catch {
    /* private mode */
  }
}

export function recalledSignupAs(): AccountType | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { as?: string; at?: number };
    if ((v.as === 'venue' || v.as === 'member') && typeof v.at === 'number' && Date.now() - v.at < MAX_AGE_MS) return v.as;
  } catch {
    /* private mode or bad value */
  }
  return null;
}

export function forgetSignupAs() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

/** `?as=venue` / `?as=member` on the current URL, if any. */
export function signupAsFromUrl(): AccountType | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('as');
  return v === 'venue' || v === 'member' ? v : null;
}
