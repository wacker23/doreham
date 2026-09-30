import { NextResponse } from 'next/server';
import { isAdminUser, requireUser } from '@/lib/server/auth';
import { getPlan } from '@/lib/server/plan';

/**
 * GET — the signed-in user's plan (Free / Doreham+) and this month's match requests.
 * The admin account has no plan limits (the database lets it through), so it shows as Doreham+.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const [plan, admin] = await Promise.all([getPlan(auth.user.id), isAdminUser(auth.user.id)]);
  return NextResponse.json(admin ? { ...plan, plus: true } : plan);
}
