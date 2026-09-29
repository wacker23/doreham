import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { snapshotPreviousMonth, syncPoints } from '@/lib/server/points';

export const maxDuration = 60;

/** Cron (every 30 min): award points for new activity, then store last month's final top 10 once. */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const sync = await syncPoints({ force: true });
    const monthly = sync.ok ? await snapshotPreviousMonth() : null;
    return NextResponse.json({ ok: sync.ok, sync, monthly });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
