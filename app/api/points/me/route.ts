import { NextResponse } from 'next/server';
import { jsonError, readJson, requireUser } from '@/lib/server/auth';
import { mySummary, setLeaderboardHidden } from '@/lib/server/points';

/** GET — my points, level, badges and history. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await mySummary(auth.user.id));
}

/** POST { leaderboard_hidden: boolean } — show or hide me on the leaderboard. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await readJson<{ leaderboard_hidden?: boolean }>(request);
  if (typeof body.leaderboard_hidden !== 'boolean') return jsonError('bad_request', 400);
  const r = await setLeaderboardHidden(auth.user.id, body.leaderboard_hidden);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, 500);
}
