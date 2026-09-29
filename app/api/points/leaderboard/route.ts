import { NextResponse } from 'next/server';
import { jsonError, requireUser } from '@/lib/server/auth';
import { leaderboard } from '@/lib/server/points';

/** GET ?period=month|all — the national leaderboard (top 50) and the viewer's own rank. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const period = new URL(request.url).searchParams.get('period') === 'all' ? 'all' : 'month';
  const r = await leaderboard(auth.user.id, period);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, 500);
}
