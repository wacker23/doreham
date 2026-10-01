import { NextResponse } from 'next/server';
import { isAdminUser, requireUser } from '@/lib/server/auth';
import { getMembership, getPlan } from '@/lib/server/plan';

/**
 * GET — the signed-in user's plan (Free / Doreham+) and this month's match requests.
 * ?details=1 adds hosting room and membership history (for the profile card).
 * The admin account has no plan limits (the database lets it through), so it shows as Doreham+.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const details = new URL(request.url).searchParams.get('details') === '1';
  const [plan, admin] = await Promise.all([
    details ? getMembership(auth.user.id) : getPlan(auth.user.id),
    isAdminUser(auth.user.id),
  ]);
  return NextResponse.json(admin ? { ...plan, plus: true } : plan);
}
